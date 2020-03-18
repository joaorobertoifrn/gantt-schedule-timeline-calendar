/**
 * ScrollBar component
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

import Action from '@neuronet.io/vido/Action';
import {
  ChartInternalTimeLevelDate,
  ScrollType,
  ChartTimeDate,
  Row,
  ScrollTypeHorizontal,
  ScrollTypeVertical
} from '../types';

export default function ScrollBar(vido, props) {
  const { onDestroy, state, api, html, StyleMap, Actions, update, schedule } = vido;

  const componentName = 'scroll-bar';

  let className, classNameInner;
  let classNameOuterActive = '',
    classNameInnerActive = '';

  onDestroy(
    state.subscribe('config.classNames', () => {
      className = api.getClass(componentName);
      classNameInner = api.getClass(componentName + '-inner');
    })
  );

  let size;
  const sizeProp = props.type === 'horizontal' ? 'height' : 'width';
  const invSizeProp = sizeProp === 'height' ? 'width' : 'height';
  const movement = props.type === 'horizontal' ? 'movementX' : 'movementY';
  const offsetProp = props.type === 'horizontal' ? 'left' : 'top';
  const styleMapOuter = new StyleMap({});
  const styleMapInner = new StyleMap({});
  let pos = 0;
  let maxPos = 0;
  let itemsCount = 0;
  let allDates = [];
  let rows = [];
  let rowsOffsets = [];
  let rowsPercents = [];

  function generateRowsOffsets() {
    const len = rows.length;
    rowsOffsets = [];
    rowsPercents = [];
    if (!len) return;
    let top = 0;
    for (let i = 0; i < len; i++) {
      const row = rows[i];
      rowsOffsets.push(top);
      top += row.height;
    }
    const verticalHeight = state.get('config.scroll.vertical.area');
    for (const offsetTop of rowsOffsets) {
      rowsPercents.push(offsetTop / verticalHeight);
    }
  }

  function setScrollLeft(currentItem: number | undefined, pos: number) {
    if (currentItem === undefined) {
      currentItem = 0;
    }
    const date: ChartInternalTimeLevelDate = allDates[currentItem];
    const horizontal: ScrollTypeHorizontal = state.get('config.scroll.horizontal');
    if (horizontal.data && horizontal.data.leftGlobal === date.leftGlobal) return;
    state.update('config.scroll.horizontal', (scrollHorizontal: ScrollTypeHorizontal) => {
      scrollHorizontal.data = date;
      scrollHorizontal.posPx = pos;
      return scrollHorizontal;
    });
  }

  function setScrollTop(currentData: number | undefined, pos: number) {
    if (currentData === undefined) {
      currentData = 0;
    }
    const vertical: ScrollTypeVertical = state.get('config.scroll.vertical');
    if (vertical.data && vertical.data.id === rows[currentData].id) return;
    state.update('config.scroll.vertical', (scrollVertical: ScrollTypeVertical) => {
      scrollVertical.data = rows[currentData];
      scrollVertical.posPx = pos;
      return scrollVertical;
    });
  }

  let working = false;
  onDestroy(
    state.subscribeAll(
      props.type === 'horizontal'
        ? [`config.scroll.${props.type}.size`, '_internal.chart.dimensions.width', '_internal.chart.time']
        : [
            `config.scroll.${props.type}.size`,
            '_internal.innerHeight',
            '_internal.list.rowsWithParentsExpanded',
            `config.scroll.${props.type}.area`
          ],
      () => {
        if (working) return;
        working = true;
        const time = state.get('_internal.chart.time');
        const scroll = state.get(`config.scroll.${props.type}`);
        const chartWidth = state.get('_internal.chart.dimensions.width');
        const chartHeight = state.get('_internal.innerHeight');
        size = scroll.size;
        let invSize = props.type === 'horizontal' ? chartWidth : chartHeight;
        invSize = invSize || 0;
        if (props.type === 'horizontal') {
          invSize -= size;
        } else {
          invSize += size;
        }
        if (invSize < 0) invSize = 0;
        styleMapOuter.style[sizeProp] = size + 'px';
        styleMapOuter.style[invSizeProp] = invSize + 'px';
        if (props.type === 'vertical') {
          styleMapOuter.style.top = state.get('config.headerHeight') + 'px';
        }
        styleMapInner.style[sizeProp] = '100%';
        let innerSize = 0;
        if (props.type === 'horizontal') {
          if (time.allDates && time.allDates[time.level]) {
            allDates = time.allDates[time.level];
            itemsCount = allDates.length;
          } else {
            allDates = [];
          }
        } else {
          const rowsWithParentsExpanded = state.get('_internal.list.rowsWithParentsExpanded');
          if (rowsWithParentsExpanded) {
            rows = rowsWithParentsExpanded;
          } else {
            rows = [];
          }
          if (rows.length) {
            itemsCount = rows.length;
            generateRowsOffsets();
          } else {
            rowsOffsets = [];
          }
        }
        innerSize = invSize / itemsCount;
        if (innerSize < scroll.minInnerSize) {
          innerSize = scroll.minInnerSize;
        }
        styleMapInner.style[invSizeProp] = innerSize + 'px';
        maxPos = invSize - innerSize;
        state.update(`config.scroll.${props.type}.maxPosPx`, maxPos);
        update();
        working = false;
      }
    )
  );

  onDestroy(
    state.subscribe(`config.scroll.${props.type}.posPx`, position => {
      styleMapInner.style[offsetProp] = position + 'px';
      pos = position;
      update();
    })
  );

  class OuterAction extends Action {
    constructor(element) {
      super();
      state.update(`_internal.elements.scroll-bar--${props.type}`, element);
    }
    update() {}
    destroy() {}
  }

  class InnerAction extends Action {
    moving = false;
    initialPos = 0;
    currentPos = 0;

    constructor(element) {
      super();
      state.update(`_internal.elements.scroll-bar-inner--${props.type}`, element);
      this.pointerDown = this.pointerDown.bind(this);
      this.pointerUp = this.pointerUp.bind(this);
      const pointerMove = this.pointerMove.bind(this);
      this.pointerMove = schedule(ev => pointerMove(ev));
      element.addEventListener('pointerdown', this.pointerDown);
      window.addEventListener('pointermove', this.pointerMove);
      window.addEventListener('pointerup', this.pointerUp);
    }

    destroy(element) {
      element.removeEventListener('pointerdown', this.pointerDown);
      window.removeEventListener('pointermove', this.pointerMove);
      window.removeEventListener('pointerup', this.pointerUp);
    }

    limitPosition(offset: number) {
      if (offset < 0) return 0;
      if (offset > maxPos) return maxPos;
      return offset;
    }

    pointerDown(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      this.moving = true;
      this.initialPos = props.type === 'horizontal' ? ev.screenX : ev.screenY;
      classNameInnerActive = ' ' + api.getClass(componentName) + '-inner--active';
      classNameOuterActive = ' ' + api.getClass(componentName) + '--active';
      update();
    }

    pointerUp(ev) {
      if (this.moving) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      this.moving = false;
      classNameInnerActive = '';
      classNameOuterActive = '';
      update();
    }

    pointerMove(ev) {
      if (this.moving) {
        ev.preventDefault();
        ev.stopPropagation();
        this.currentPos = props.type === 'horizontal' ? ev.screenX : ev.screenY;
        pos = this.limitPosition(pos + ev[movement]);
        const percent = pos / maxPos;
        let currentItem;
        if (props.type === 'horizontal') {
          const date = allDates.find(date => date.leftPercent >= percent);
          currentItem = allDates.indexOf(date);
        } else {
          for (let i = 0, len = rowsPercents.length; i < len; i++) {
            const rowPercent = rowsPercents[i];
            if (rowPercent >= percent) {
              currentItem = i;
              break;
            }
          }
        }
        if (!currentItem) currentItem = 0;
        if (props.type === 'horizontal') {
          setScrollLeft(currentItem, pos);
        } else {
          setScrollTop(currentItem, pos);
        }
      }
    }
  }

  const outerComponentActions = api.getActions(componentName);
  outerComponentActions.push(OuterAction);
  const outerActions = Actions.create(outerComponentActions, { api, state, props });
  const innerComponentActions = [InnerAction];
  const innerActions = Actions.create(innerComponentActions, { api, state, props });

  return () =>
    html`
      <div
        data-actions=${outerActions}
        class=${className + ' ' + className + '--' + props.type + classNameOuterActive}
        style=${styleMapOuter}
      >
        <div
          data-actions=${innerActions}
          class=${classNameInner + ' ' + classNameInner + '--' + props.type + classNameInnerActive}
          style=${styleMapInner}
        ></div>
      </div>
    `;
}
