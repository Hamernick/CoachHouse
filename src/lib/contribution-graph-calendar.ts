import {
  differenceInCalendarDays,
  eachDayOfInterval,
  formatISO,
  getDay,
  getMonth,
  nextDay,
  parseISO,
  subWeeks,
  type Day as WeekDay,
} from "date-fns"

export type Activity = {
  date: string
  count: number
  level: number
}

export type Week = Array<Activity | undefined>

type MonthLabel = {
  weekIndex: number
  label: string
}

export const DEFAULT_MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

const fillHoles = (activities: Activity[]): Activity[] => {
  if (activities.length === 0) {
    return []
  }

  // Sort activities by date to ensure correct date range
  const sortedActivities = [...activities].sort((a, b) =>
    a.date.localeCompare(b.date)
  )

  const calendar = new Map<string, Activity>(activities.map((a) => [a.date, a]))

  const firstActivity = sortedActivities[0] as Activity
  const lastActivity = sortedActivities.at(-1)

  if (!lastActivity) {
    return []
  }

  return eachDayOfInterval({
    start: parseISO(firstActivity.date),
    end: parseISO(lastActivity.date),
  }).map((day) => {
    const date = formatISO(day, { representation: "date" })

    if (calendar.has(date)) {
      return calendar.get(date) as Activity
    }

    return {
      date,
      count: 0,
      level: 0,
    }
  })
}

export const groupByWeeks = (
  activities: Activity[],
  weekStart: WeekDay = 0
): Week[] => {
  if (activities.length === 0) {
    return []
  }

  const normalizedActivities = fillHoles(activities)
  const firstActivity = normalizedActivities[0] as Activity
  const firstDate = parseISO(firstActivity.date)
  const firstCalendarDate =
    getDay(firstDate) === weekStart
      ? firstDate
      : subWeeks(nextDay(firstDate, weekStart), 1)

  const paddedActivities = [
    ...(new Array(differenceInCalendarDays(firstDate, firstCalendarDate)).fill(
      undefined
    ) as Activity[]),
    ...normalizedActivities,
  ]

  const numberOfWeeks = Math.ceil(paddedActivities.length / 7)

  return new Array(numberOfWeeks)
    .fill(undefined)
    .map((_, weekIndex) =>
      paddedActivities.slice(weekIndex * 7, weekIndex * 7 + 7)
    )
}

export const getMonthLabels = (
  weeks: Week[],
  monthNames: string[] = DEFAULT_MONTH_LABELS
): MonthLabel[] => {
  return weeks
    .reduce<MonthLabel[]>((labels, week, weekIndex) => {
      const firstActivity = week.find((activity) => activity !== undefined)

      if (!firstActivity) {
        throw new Error(
          `Unexpected error: Week ${weekIndex + 1} is empty: [${week}].`
        )
      }

      const month = monthNames[getMonth(parseISO(firstActivity.date))]

      if (!month) {
        const monthName = new Date(firstActivity.date).toLocaleString("en-US", {
          month: "short",
        })
        throw new Error(
          `Unexpected error: undefined month label for ${monthName}.`
        )
      }

      const prevLabel = labels.at(-1)

      if (weekIndex === 0 || !prevLabel || prevLabel.label !== month) {
        return labels.concat({ weekIndex, label: month })
      }

      return labels
    }, [])
    .filter(({ weekIndex }, index, labels) => {
      const minWeeks = 3

      if (index === 0) {
        return labels[1] && labels[1].weekIndex - weekIndex >= minWeeks
      }

      if (index === labels.length - 1) {
        return weeks.slice(weekIndex).length >= minWeeks
      }

      return true
    })
}
