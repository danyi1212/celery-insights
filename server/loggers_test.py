import logging

from logging_config import LOGGING_CONFIG


def test_all_loggers_are_configured():
    import run  # noqa: F401

    available_root_loggers = {logger_name for logger_name in logging.root.manager.loggerDict if "." not in logger_name}
    configured_loggers = LOGGING_CONFIG["loggers"].keys()

    missing_loggers = available_root_loggers - configured_loggers

    assert not missing_loggers, f"Missing logging configuration for {len(missing_loggers)} loggers"
