from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from metrics.router import get_metrics, get_metrics_system, get_metrics_verbose


@pytest.fixture(autouse=True)
def _mock_collectors(mocker: MockerFixture):
    mocker.patch("metrics.router.collect_tier1", new_callable=AsyncMock, return_value=b"# tier1\n")
    mocker.patch("metrics.router.collect_tier2", new_callable=AsyncMock, return_value=b"# tier2\n")
    mocker.patch("metrics.router.collect_tier3", new_callable=AsyncMock, return_value=b"# tier3\n")


class TestGetMetrics:
    @pytest.mark.asyncio
    async def test_returns_prometheus_content_type(self):
        response = await get_metrics()
        assert response.media_type == "text/plain; version=0.0.4; charset=utf-8"

    @pytest.mark.asyncio
    async def test_returns_tier1_output(self):
        response = await get_metrics()
        assert response.body == b"# tier1\n"


class TestGetMetricsVerbose:
    @pytest.mark.asyncio
    async def test_returns_tier2_output(self):
        response = await get_metrics_verbose()
        assert response.body == b"# tier2\n"


class TestGetMetricsSystem:
    @pytest.mark.asyncio
    async def test_returns_tier3_output(self, mocker: MockerFixture):
        request = mocker.MagicMock()
        request.app.state.ingester = None
        response = await get_metrics_system(request)
        assert response.body == b"# tier3\n"

    @pytest.mark.asyncio
    async def test_passes_ingester_from_app_state(self, mocker: MockerFixture):
        mock_collect = mocker.patch("metrics.router.collect_tier3", new_callable=AsyncMock, return_value=b"# tier3\n")
        ingester = mocker.MagicMock()
        request = mocker.MagicMock()
        request.app.state.ingester = ingester

        await get_metrics_system(request)

        mock_collect.assert_called_once_with(ingester)
