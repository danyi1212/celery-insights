import {
  TimeRangePicker as PackageTimeRangePicker,
  type TimeRange,
  type TimeRangePickerProps,
} from "@danyi1212/time-range-picker"

type AppTimeRangePickerProps = Omit<TimeRangePickerProps, "clockFormat">

export type { TimeRange }

const AppTimeRangePicker = (props: AppTimeRangePickerProps) => <PackageTimeRangePicker clockFormat="24h" {...props} />

export default AppTimeRangePicker
