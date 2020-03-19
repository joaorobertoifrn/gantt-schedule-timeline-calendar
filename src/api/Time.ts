/**
 * Gantt-Schedule-Timeline-Calendar
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0
 */

import dayjs, { OpUnitType, Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  Locale,
  ChartInternalTime,
  ChartInternalTimeLevelDate,
  ChartTimeDate,
  Scroll,
  ChartInternalTimeLevel,
  ScrollTypeHorizontal,
  Period
} from '../types';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import weekOfYear from 'dayjs/plugin/weekOfYear';

dayjs.extend(advancedFormat);
dayjs.extend(weekOfYear);

export default class TimeApi {
  private locale: Locale;
  private utcMode = false;
  private state: any;

  constructor(state) {
    this.state = state;
    this.locale = state.get('config.locale');
    this.utcMode = state.get('config.utcMode');
    if (this.utcMode) {
      dayjs.extend(utc);
    }
    // @ts-ignore
    dayjs.locale(this.locale, null, true);
  }

  public date(time) {
    const _dayjs = this.utcMode ? dayjs.utc : dayjs;
    return time ? _dayjs(time).locale(this.locale.name) : _dayjs().locale(this.locale.name);
  }

  private addAdditionalSpace(time: ChartInternalTime) {
    if (time.additionalSpaces && time.additionalSpaces[time.period]) {
      const add = time.additionalSpaces[time.period];
      if (add.before) {
        time.finalFrom = this.date(time.from)
          .subtract(add.before, add.period)
          .valueOf();
      }
      if (add.after) {
        time.finalTo = this.date(time.to)
          .add(add.after, add.period)
          .valueOf();
      }
    }
    return time;
  }

  public recalculateFromTo(time: ChartInternalTime) {
    const period = time.period;
    time = { ...time };
    time.from = +time.from;
    time.to = +time.to;

    let from = Number.MAX_SAFE_INTEGER,
      to = 0;
    const items = this.state.get('config.chart.items');
    if (Object.keys(items).length > 0) {
      if (time.from === 0 || time.to === 0) {
        for (const itemId in items) {
          const item = items[itemId];
          if (item.time.start < from && item.time.start) {
            from = item.time.start;
          }
          if (item.time.end > to) {
            to = item.time.end;
          }
        }
        if (time.from === 0) {
          time.from = this.date(from)
            .startOf(period)
            .valueOf();
        }
        if (time.to === 0) {
          time.to = this.date(to)
            .endOf(period)
            .valueOf();
        }
        time.fromDate = this.date(time.from);
        time.toDate = this.date(time.to);
      }
    }
    time.finalFrom = time.fromDate.startOf(period).valueOf();
    time.finalTo = time.toDate.startOf(period).valueOf();
    time = this.addAdditionalSpace(time);
    return time;
  }

  public getCenter(time: ChartInternalTime) {
    return time.leftGlobal + (time.rightGlobal - time.leftGlobal) / 2;
  }

  public getOffsetPxFromDates(
    date: Dayjs,
    levelDates: ChartInternalTimeLevelDate[],
    period: Period,
    time: ChartInternalTime
  ): number {
    const milliseconds = date.valueOf();
    let firstMatching;
    // find first date that is after milliseconds
    for (let i = 0, len = levelDates.length; i < len; i++) {
      const date = levelDates[i];
      if (date.rightGlobal >= milliseconds) {
        firstMatching = levelDates[i];
        break;
      }
    }
    if (firstMatching) {
      let localDiffMs = milliseconds - firstMatching.leftGlobal;
      // if dates are skipped localDiffMs may be long as couple of periods
      // and after subtraction will land couple of periods to early
      // we need to define those periods and subtract them from localDiffMs
      const missingPeriods = Math.floor(
        firstMatching.leftGlobalDate.startOf(period).diff(date.startOf(period), period, true)
      );
      if (missingPeriods) {
        localDiffMs = date.add(missingPeriods, period).valueOf() - firstMatching.leftGlobal;
      }
      const localDiffPx = Math.round(localDiffMs / time.timePerPixel);
      return firstMatching.currentView.leftPx + localDiffPx;
    } else {
      // date is out of the current scope (view)
      if (date.valueOf() < time.leftGlobal) return 0;
      return time.width;
    }
  }

  public findDateAtOffsetPx(offsetPx: number, allPeriodDates: ChartTimeDate[]): ChartTimeDate | undefined {
    return allPeriodDates.find(date => date.leftPx >= offsetPx);
  }

  public findDateAtTime(milliseconds: number, allPeriodDates: ChartTimeDate[]): ChartTimeDate | undefined {
    return allPeriodDates.find(date => date.rightGlobal >= milliseconds);
  }

  public calculateScrollPosPxFromTime(
    milliseconds: number,
    time: ChartInternalTime | undefined,
    scroll: ScrollTypeHorizontal | undefined
  ) {
    if (!scroll) scroll = this.state.get('config.scroll.horizontal');
    if (!scroll.maxPosPx) return 0;
    if (!time) time = this.state.get('_internal.chart.time');
    const date: ChartInternalTimeLevelDate = this.findDateAtTime(milliseconds, time.allDates[time.level]);
    return Math.round(scroll.maxPosPx * date.leftPercent);
  }

  public getDatesDiffPx(fromTime: number, toTime: number, dates: ChartTimeDate[], startToStart = true): number {
    if (fromTime === toTime && startToStart) return 0;
    let width = 0;
    let startCounting = false;
    let inverse = false;
    if (toTime < fromTime) {
      const initialFrom = fromTime;
      fromTime = toTime;
      toTime = initialFrom;
      inverse = true;
    }
    for (const date of dates) {
      if (date.leftGlobal >= fromTime) {
        startCounting = true;
      }
      if (date.rightGlobal >= toTime) {
        break;
      }
      if (startCounting) width += date.width;
    }
    return inverse ? -width : width;
  }
}
