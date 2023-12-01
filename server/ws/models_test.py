import pytest

from ws.models import UserAgentInfo


def test_user_agent_parse():
    header = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/58.0.3029.110 Safari/537.36"
    )
    expected = UserAgentInfo(
        os="Windows",
        os_version="10",
        device_family="Other",
        device_brand=None,
        device_model=None,
        browser="Chrome",
        browser_version="58.0.3029",
    )

    actual = UserAgentInfo.parse(header)

    assert actual == expected


@pytest.mark.parametrize("header", [None, "", "invalid", object()])
def test_user_agent_parse_invalid(header: str):
    actual = UserAgentInfo.parse(header)

    assert actual == UserAgentInfo(
        os="Other",
        os_version="",
        device_family="Other",
        device_brand=None,
        device_model=None,
        browser="Other",
        browser_version="",
    )
