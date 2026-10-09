import json
from io import BytesIO

import pytest

import settings as settings_module
from logging_config import build_logging_config
from settings import MAX_HANDOFF_BYTES, Settings, read_settings_snapshot


def install_packet(monkeypatch: pytest.MonkeyPatch, packet: bytes) -> None:
    monkeypatch.setattr(settings_module.os, "fdopen", lambda *_args: BytesIO(packet))


def test_snapshot_is_authoritative_over_inherited_environment(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("BROKER_URL", "inherited-secret")
    monkeypatch.setenv("LOG_LEVEL", "error")
    expected = Settings(broker_url="resolved-secret", log_format="json", log_level="debug")
    install_packet(monkeypatch, json.dumps({"version": 1, "settings": expected.model_dump()}).encode())
    actual = read_settings_snapshot()
    assert actual.broker_url == "resolved-secret"
    assert actual.log_level == "debug"
    config = build_logging_config(actual.log_format, actual.log_level)
    assert config["root"]["level"] == "DEBUG"
    assert config["formatters"]["unified"]["()"] == "dans_log_formatter.JsonLogFormatter"
    assert "resolved-secret" not in repr(actual)


@pytest.mark.parametrize(
    "packet",
    [
        b"",
        b"not JSON",
        b'{"version":2,"settings":{}}',
        b'{"version":true,"settings":{}}',
        b'{"version":1,"settings":{}}',
        b"x" * (MAX_HANDOFF_BYTES + 1),
    ],
)
def test_invalid_handoff_fails_without_configuration_fallback(monkeypatch: pytest.MonkeyPatch, packet: bytes):
    install_packet(monkeypatch, packet)
    with pytest.raises(RuntimeError, match="Invalid or missing Bun configuration handoff"):
        read_settings_snapshot()


def test_transport_error_does_not_expose_secret_values(monkeypatch: pytest.MonkeyPatch):
    fields = Settings().model_dump()
    fields["broker_url"] = {"password": "DO-NOT-DISCLOSE"}
    install_packet(monkeypatch, json.dumps({"version": 1, "settings": fields}).encode())
    with pytest.raises(RuntimeError) as caught:
        read_settings_snapshot()
    assert "DO-NOT-DISCLOSE" not in str(caught.value)


def test_python_settings_do_not_resolve_environment(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("PORT", "1234")
    monkeypatch.setenv("BROKER_URL", "env-secret")
    assert "port" not in Settings.model_fields
    assert Settings().broker_url != "env-secret"


def test_authentication_data_is_rejected_by_python_snapshot(monkeypatch):
    fields = Settings().model_dump()
    fields["authentication"] = {"control_password": "DO-NOT-DISCLOSE"}
    install_packet(monkeypatch, json.dumps({"version": 1, "settings": fields}).encode())
    with pytest.raises(RuntimeError) as caught:
        read_settings_snapshot()
    assert "DO-NOT-DISCLOSE" not in str(caught.value)
    assert "authentication" not in Settings.model_fields
