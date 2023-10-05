from typing import Annotated

from pydantic import Field, FiniteFloat

EpochTimestamp = Annotated[FiniteFloat, Field(gt=0)]
