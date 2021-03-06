import date_utils from './date_utils';
import { $, createSVG } from './svg_utils';
import Bar from './bar';
import Flag from './flag';
import Arrow from './arrow';
import Popup from './popup';

import './gantt.scss';

var numberOfBarsDrawn = 0;

export default class Gantt {
    constructor(wrapper, tasks, milestones, options) {
        this.setup_wrapper(wrapper);
        this.setup_options(options);
        this.setup_tasks(tasks);
        this.setup_milestones(milestones);
        // initialize with default view mode
        this.change_view_mode();
        this.bind_events();
    }

    setup_wrapper(element) {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }

        if (!(element instanceof HTMLElement)) {
            throw new Error('Invalid argument passed for element');
        }

        // parent div element
        this.$container = document.createElement('div');
        this.$container.classList.add('gantt-container');
        element.appendChild(this.$container);

        // parent svg element
        this.$svg_header = createSVG('svg', {
            append_to: this.$container,
            class: 'gantt_header'
        });

        this.$svg = createSVG('svg', {
            append_to: this.$container,
            class: 'gantt'
        });

        // popup wrapper
        this.popup_wrapper = document.createElement('div');
        this.popup_wrapper.classList.add('popup-wrapper');
        this.$svg_header.parentElement.appendChild(this.popup_wrapper);
        this.$svg.parentElement.appendChild(this.popup_wrapper);
    }

    setup_options(options) {
        const default_options = {
            header_height: 50,
            column_width: 30,
            step: 24,
            view_modes: [
                'Hour',
                'Quarter Day',
                'Half Day',
                'Day',
                'Week',
                'Month',
                'Max'
            ],
            bar_height: 20,
            bar_corner_radius: 1,
            arrow_curve: 5,
            padding: 18,
            view_mode: 'Day',
            date_format: 'YYYY-MM-DD',
            custom_popup_html: null
        };
        this.options = Object.assign({}, default_options, options);
    }

    setup_tasks(tasks) {
        // prepare tasks
        this.tasks = tasks.map((task, i) => {
            // convert to Date objects
            task._start = date_utils.parse((this.options.view_mode == "Hour") ? date_utils.start_of(task.start, 'hour') : date_utils.start_of(task.start, 'day'));
            task._end = date_utils.parse((this.options.view_mode == "Hour") ? date_utils.start_of(task.end, 'hour') : date_utils.start_of(task.end, 'day'));

            task._start_delay = task.delay.start ? date_utils.parse((this.options.view_mode == "Hour") ? date_utils.start_of(task.delay.start, 'hour') : date_utils.start_of(task.delay.start, 'day')) : null;
            task._start_overdue = task.overdue.start ? date_utils.parse((this.options.view_mode == "Hour") ? date_utils.start_of(task.overdue.start, 'hour') : date_utils.start_of(task.overdue.start, 'day')) : null;
            task._end_delay = task.delay.end ? date_utils.parse((this.options.view_mode == "Hour") ? date_utils.start_of(task.delay.end, 'hour') : date_utils.start_of(task.delay.end, 'day')) : null;
            task._end_overdue = task.overdue.end ? date_utils.parse((this.options.view_mode == "Hour") ? date_utils.start_of(task.overdue.end, 'hour') : date_utils.start_of(task.overdue.end, 'day')) : null;

            // make task invalid if duration too large
            if (date_utils.diff(task._end, task._start, 'year') > 10) {
                task.end = null;
            }

            // cache index
            task._index = i;

            // invalid dates
            if (!task.start && !task.end) {
                const today = date_utils.today();
                task._start = today;
                task._end = date_utils.add(today, 2, 'day');
                task._start_delay = task._start;
                task._end_delay = task._end;
                task._start_overdue = task._start;
                task._end_overdue = task._end;
            }

            if (!task.start && task.end) {
                task._start = date_utils.add(task._end, -2, 'day');
                task._start_delay = task._start;
                task._start_overdue = task._start;
            }

            if (task.start && !task.end) {
                task._end = date_utils.add(task._start, 2, 'day');
                task._end_delay = task._end;
                task._end_overdue = task._end;
            }

            // invalid flag
            if (!task.start || !task.end) {
                task.invalid = true;
            }

            // dependencies
            if (typeof task.dependencies === 'string' || !task.dependencies) {
                let deps = [];
                if (task.dependencies) {
                    deps = task.dependencies
                        .split(',')
                        .map(d => d.trim())
                        .filter(d => d);
                }
                task.dependencies = deps;
            }

            // uids
            if (!task.id) {
                task.id = generate_id(task);
            }

            return task;
        });

        this.setup_dependencies();
    }

    setup_milestones(milestones) {
        // prepare milestones
        this.milestones = milestones.map((milestone, i) => {
            // convert to Date objects
            milestone._date = date_utils.parse((this.options.view_mode == "Hour") ? date_utils.start_of(milestone.date, 'hour') : date_utils.start_of(milestone.date, 'day'));


            // cache index
            milestone._index = i;

            // invalid date
            if (!milestone.date) {
                const today = date_utils.today();
                milestone._date = today;
            }

            // invalid flag
            if (!milestone.date) {
                milestone.date = true;
            }

            // uids
            if (!milestone.id) {
                milestone.id = generate_id(milestone);
            }

            return milestone;
        });
    }

    setup_dependencies() {
        this.dependency_map = {};
        for (let t of this.tasks) {
            for (let d of t.dependencies) {
                this.dependency_map[d] = this.dependency_map[d] || [];
                this.dependency_map[d].push(t.id);
            }
        }
    }

    refresh(tasks, milestones) {
        this.setup_tasks(tasks);
        this.setup_milestones(milestones)
        this.change_view_mode();
    }

    change_view_mode(mode = this.options.view_mode, tasks = this.tasks) {
        var firstTaskStart = tasks.reduce(function(prev, curr) {
            return date_utils.diff(prev.start, curr.start, 'day') < 0
                ? prev
                : curr;
        });
        var lastTaskEnd = tasks.reduce(function(prev, curr) {
            return date_utils.diff(prev.end, curr.end, 'day') > 0 ? prev : curr;
        });
        var max = date_utils.diff(lastTaskEnd.end, firstTaskStart.start, 'day');

        this.update_view_scale(mode, max);
        this.setup_dates();
        this.render();
        // fire viewmode_change event
        this.trigger_event('view_change', [mode]);
    }

    update_view_scale(view_mode, max) {
        this.options.view_mode = view_mode;

        if (view_mode === 'Hour') {
            this.options.step = 24 / 24;
            this.options.column_width = 38;
        } else if (view_mode === 'Day') {
            this.options.step = 24;
            this.options.column_width = 38;
        } else if (view_mode === 'Half Day') {
            this.options.step = 24 / 2;
            this.options.column_width = 38;
        } else if (view_mode === 'Quarter Day') {
            this.options.step = 24 / 4;
            this.options.column_width = 38;
        } else if (view_mode === 'Week') {
            this.options.step = 24 * 7;
            this.options.column_width = 140;
        } else if (view_mode === 'Month') {
            this.options.step = 24 * 30;
            this.options.column_width = 120;
        } else if (view_mode === 'Max') {
            this.options.step = 24 * 30;
            this.options.column_width =
                Math.floor(document.getElementById('one').offsetWidth - 200) *
                30 /
                max;
        }
    }

    setup_dates() {
        this.setup_gantt_dates();
        this.setup_date_values();
    }

    setup_gantt_dates() {
        this.gantt_start = this.gantt_end = null;

        for (let task of this.tasks) {
            // set global start and end date
            if (!this.gantt_start || task._start < this.gantt_start) {
                this.gantt_start = task._start;
            }
            if (!this.gantt_end || task._end > this.gantt_end) {
                this.gantt_end = task._end;
            }
        }

        // add date padding on both sides
        if (this.view_is(['Hour', 'Quarter Day', 'Half Day'])) {
            this.gantt_start = date_utils.add(this.gantt_start, -1, 'day');
            this.gantt_end = date_utils.add(this.gantt_end, 1, 'day');
        } else if (this.view_is('Month')) {
            this.gantt_start = date_utils.add(this.gantt_start, -13, 'month');
            this.gantt_end = date_utils.add(this.gantt_end, 10, 'month');
        } else if (this.view_is('Max')) {
            this.gantt_start = date_utils.add(this.gantt_start, -13, 'month');
            this.gantt_end = date_utils.add(this.gantt_end, 10, 'month');
        } else if (this.view_is('Week')) {
            this.gantt_start = date_utils.add(this.gantt_start, -1, 'month');
            this.gantt_end = date_utils.add(this.gantt_end, 1, 'month');
        } else if (this.view_is('Day')) {
            this.gantt_start = date_utils.add(this.gantt_start, -15, 'day');
            this.gantt_end = date_utils.add(this.gantt_end, 15, 'day');
        }
    }

    setup_date_values() {
        this.dates = [];
        let cur_date = null;

        while (cur_date === null || cur_date < this.gantt_end) {
            if (!cur_date) {
                cur_date = date_utils.clone(this.gantt_start);
            } else {
                cur_date =
                    this.view_is('Month') || this.view_is('Max')
                        ? date_utils.add(cur_date, 1, 'month')
                        : date_utils.add(cur_date, this.options.step, 'hour');
            }
            this.dates.push(cur_date);
        }
    }

    bind_events() {
        this.bind_grid_click();
        this.bind_bar_events();
    }

    render() {
        this.clear();
        this.setup_layers();
        this.make_grid();
        this.make_dates();
        this.make_bars();
        this.make_arrows();
        this.make_flags();
        this.map_arrows_on_bars();
        this.set_width();
        this.set_scroll_position();
    }

    setup_layers() {
        this.layers = {};
        // const layers = ['grid', 'date', 'arrow', 'progress', 'bar', 'details'];
        const layers_header = ['grid_header', 'date'];
        const layers = ['grid', 'arrow', 'progress', 'bar', 'details'];
        // make group layers
        for (let layer of layers_header) {
            this.layers[layer] = createSVG('g', {
                class: layer,
                append_to: this.$svg_header
            });
        }
        for (let layer of layers) {
            this.layers[layer] = createSVG('g', {
                class: layer,
                append_to: this.$svg
            });
        }
    }

    make_grid() {
        this.make_grid_rows();
        this.make_grid_background();
        this.make_grid_header();
        this.make_grid_ticks();
        this.make_grid_highlights();
    }

    make_grid_background() {
        const grid_width = this.dates.length * this.options.column_width;
        const grid_height =
            this.options.header_height +
            this.options.padding +
            (this.options.bar_height + this.options.padding) *
                numberOfBarsDrawn;

        createSVG('rect', {
            x: 0,
            y: 0,
            width: grid_width,
            height: grid_height,
            class: 'grid-background',
            append_to: this.layers.grid
        });

        $.attr(this.$svg, {
            height: grid_height + this.options.padding + 100,
            width: '100%'
        });
    }

    make_grid_rows() {
        const rows_layer = createSVG('g', { append_to: this.layers.grid });
        const lines_layer = createSVG('g', { append_to: this.layers.grid });

        const row_width = this.dates.length * this.options.column_width;
        const row_height = this.options.bar_height + this.options.padding;

        let row_y = this.options.header_height + this.options.padding / 2;

        let displayed_rows = 0;
        for (let task of this.tasks) {
            createSVG('rect', {
                x: 0,
                y: row_y,
                width: row_width,
                height: row_height,
                class: 'grid-row',
                append_to: rows_layer
            });

            createSVG('line', {
                x1: 0,
                y1: row_y + row_height,
                x2: row_width,
                y2: row_y + row_height,
                class: 'row-line',
                append_to: lines_layer
            });

            row_y += this.options.bar_height + this.options.padding;
            displayed_rows++;
        }

        const gantt_container_height = parseInt(
            window.getComputedStyle(
                document.getElementsByClassName('gantt-container')[0]
            ).height,
            10
        );
        while (displayed_rows * row_height < gantt_container_height) {
            createSVG('rect', {
                x: 0,
                y: row_y,
                width: row_width,
                height: row_height,
                class: 'grid-row',
                append_to: rows_layer
            });

            createSVG('line', {
                x1: 0,
                y1: row_y + row_height,
                x2: row_width,
                y2: row_y + row_height,
                class: 'row-line',
                append_to: lines_layer
            });

            row_y += this.options.bar_height + this.options.padding;
            displayed_rows++;
        }
        numberOfBarsDrawn = displayed_rows;
    }

    make_grid_header() {
        const header_width = this.dates.length * this.options.column_width;
        const header_height = this.options.header_height + 10;
        createSVG('rect', {
            x: 0,
            y: 0,
            width: header_width,
            height: header_height,
            class: 'grid-header',
            append_to: this.layers.grid_header
        });
    }

    make_grid_ticks() {
        let tick_x = 0;
        let tick_y = this.options.header_height + this.options.padding / 2;
        let tick_height =
            (this.options.bar_height + this.options.padding) *
            numberOfBarsDrawn;

        for (let date of this.dates) {
            let tick_class = 'tick';
            // thick tick for monday
            if (this.view_is('Day') && date.getDate() === 1) {
                tick_class += ' thick';
            }
            // thick tick for first week
            if (
                this.view_is('Week') &&
                date.getDate() >= 1 &&
                date.getDate() < 8
            ) {
                tick_class += ' thick';
            }
            // thick ticks for quarters
            if (
                this.view_is('Month') || this.view_is('Max') &&
                (date.getMonth() + 1) % 3 === 0
            ) {
                tick_class += ' thick';
            }

            createSVG('path', {
                d: `M ${tick_x}` + ' ' + `${tick_y}` + ' ' + `v ${tick_height}`,
                class: tick_class,
                append_to: this.layers.grid
            });

            if (this.view_is('Month') || this.view_is('Max')) {
                tick_x +=
                    date_utils.get_days_in_month(date) *
                    this.options.column_width /
                    30;
            } else {
                tick_x += this.options.column_width;
            }
        }
    }

    make_grid_highlights() {
        // highlight today's date
        if (this.view_is('Hour')) {
            const x =
                date_utils.diff(date_utils.now(), this.gantt_start, 'hour') /
                this.options.step *
                this.options.column_width;
            const y = 0;
            const width = this.options.column_width;

            const height =
                (this.options.bar_height + this.options.padding) *
                    numberOfBarsDrawn +
                this.options.header_height +
                this.options.padding / 2;

            createSVG('rect', {
                x,
                y,
                width,
                height,
                class: 'today-highlight',
                append_to: this.layers.grid
            });
        } else if (this.view_is('Day')) {
            const x =
                date_utils.diff(date_utils.today(), this.gantt_start, 'hour') /
                this.options.step *
                this.options.column_width;
            const y = 0;
            const width = this.options.column_width;

            const height =
                (this.options.bar_height + this.options.padding) *
                    numberOfBarsDrawn +
                this.options.header_height +
                this.options.padding / 2;

            createSVG('rect', {
                x,
                y,
                width,
                height,
                class: 'today-highlight',
                append_to: this.layers.grid
            });
        } else if (this.view_is('Week')) {
            const x =
                date_utils.diff(date_utils.today(), this.gantt_start, 'hour') /
                this.options.step *
                this.options.column_width;
            const y = 0;
            const width = this.options.column_width / 7;

            const height =
                (this.options.bar_height + this.options.padding) *
                    numberOfBarsDrawn +
                this.options.header_height +
                this.options.padding / 2;

            createSVG('rect', {
                x,
                y,
                width,
                height,
                class: 'today-highlight',
                append_to: this.layers.grid
            });
        } else if (this.view_is('Month') || this.view_is('Max')) {
            const x =
                date_utils.diff(date_utils.today(), this.gantt_start, 'hour') /
                this.options.step *
                this.options.column_width;
            const y = 0;
            const width =
                this.options.column_width /
                date_utils.get_days_in_month(date_utils.today());

            const height =
                (this.options.bar_height + this.options.padding) *
                    numberOfBarsDrawn +
                this.options.header_height +
                this.options.padding / 2;

            createSVG('rect', {
                x,
                y,
                width,
                height,
                class: 'today-highlight',
                append_to: this.layers.grid
            });
        }
    }

    make_dates() {
        for (let date of this.get_dates_to_draw()) {
            createSVG('text', {
                x: date.lower_x,
                y: date.lower_y,
                innerHTML: date.lower_text,
                class: 'lower-text',
                append_to: this.layers.date
            });

            if (date.upper_text) {
                const $upper_text = createSVG('text', {
                    x: date.upper_x,
                    y: date.upper_y,
                    innerHTML: date.upper_text,
                    class: 'upper-text',
                    append_to: this.layers.date
                });

                // remove out-of-bound dates
                if (
                    $upper_text.getBBox().x2 > this.layers.grid.getBBox().width
                ) {
                    $upper_text.remove();
                }
            }
        }
    }

    get_dates_to_draw() {
        let last_date = null;
        const dates = this.dates.map((date, i) => {
            const d = this.get_date_info(date, last_date, i);
            last_date = date;
            return d;
        });
        return dates;
    }

    get_date_info(date, last_date, i) {
        if (!last_date) {
            last_date = date_utils.add(date, 1, 'year');
        }
        const date_text = {
            Hour_lower: date_utils.format(date, 'HH'),
            'Quarter Day_lower': date_utils.format(date, 'HH'),
            'Half Day_lower': date_utils.format(date, 'HH'),
            Day_lower:
                date.getDate() !== last_date.getDate()
                    ? date_utils.format(date, 'd')
                    : '',
            Week_lower:
                date.getMonth() !== last_date.getMonth()
                    ? date_utils.format(date, 'd MMM')
                    : date_utils.format(date, 'd'),
            Month_lower: date_utils.format(date, 'MMMM'),
            Max_lower:
                date_utils.format(date, 'MM') % 3 == 0
                    ? date_utils.format(date, 'MM')
                    : '',
            Hour_upper:
                date.getDate() !== last_date.getDate()
                    ? date.getMonth() !== last_date.getMonth()
                      ? date_utils.format(date, 'd MMM')
                      : date_utils.format(date, 'd')
                    : '',
            'Quarter Day_upper':
                date.getDate() !== last_date.getDate()
                    ? date_utils.format(date, 'd MMM')
                    : '',
            'Half Day_upper':
                date.getDate() !== last_date.getDate()
                    ? date.getMonth() !== last_date.getMonth()
                      ? date_utils.format(date, 'd MMM')
                      : date_utils.format(date, 'd')
                    : '',
            Day_upper:
                date.getMonth() !== last_date.getMonth()
                    ? date_utils.format(date, 'MMMM')
                    : '',
            Week_upper:
                date.getMonth() !== last_date.getMonth()
                    ? date_utils.format(date, 'MMMM')
                    : '',
            Month_upper:
                date.getFullYear() !== last_date.getFullYear()
                    ? date_utils.format(date, 'YYYY')
                    : '',
            Max_upper:
                date.getFullYear() !== last_date.getFullYear()
                    ? date_utils.format(date, 'YYYY')
                    : ''
        };

        const base_pos = {
            x: i * this.options.column_width,
            lower_y: this.options.header_height,
            upper_y: this.options.header_height - 25
        };

        const x_pos = {
            Hour_lower: this.options.column_width / 4,
            Hour_upper: 0,
            'Quarter Day_lower': this.options.column_width * 4 / 2,
            'Quarter Day_upper': 0,
            'Half Day_lower': this.options.column_width * 2 / 2,
            'Half Day_upper': 0,
            Day_lower: this.options.column_width / 4,
            Day_upper: this.options.column_width * 30 / 2,
            Week_lower: 0,
            Week_upper: this.options.column_width * 4 / 2,
            Month_lower: this.options.column_width / 3,
            Month_upper: this.options.column_width * 12 / 2,
            Max_lower: this.options.column_width / 3,
            Max_upper: this.options.column_width * 12 / 2
        };

        return {
            upper_text: date_text[`${this.options.view_mode}_upper`],
            lower_text: date_text[`${this.options.view_mode}_lower`],
            upper_x: base_pos.x + x_pos[`${this.options.view_mode}_upper`],
            upper_y: base_pos.upper_y,
            lower_x: base_pos.x + x_pos[`${this.options.view_mode}_lower`],
            lower_y: base_pos.lower_y
        };
    }

    make_bars() {
        this.bars = this.tasks.map(task => {
            const bar = new Bar(this, task);
            this.layers.bar.appendChild(bar.group);
            return bar;
        });
    }

    make_arrows() {
        this.arrows = [];
        for (let task of this.tasks) {
            let arrows = [];
            arrows = task.dependencies
                .map(task_id => {
                    const dependency = this.get_task(task_id);
                    if (!dependency) return;
                    const arrow = new Arrow(
                        this,
                        this.bars[dependency._index], // from_task
                        this.bars[task._index] // to_task
                    );
                    this.layers.arrow.appendChild(arrow.element);
                    return arrow;
                })
                .filter(Boolean); // filter falsy values
            this.arrows = this.arrows.concat(arrows);
        }
    }

    make_flags() {
        this.flags = this.milestones.forEach(milestone => {
            const flag = new Flag(this, milestone, numberOfBarsDrawn);
            this.layers.grid.appendChild(flag.group);
            return flag;
        });
    }

    map_arrows_on_bars() {
        for (let bar of this.bars) {
            bar.arrows = this.arrows.filter(arrow => {
                return (
                    arrow.from_task.task.id === bar.task.id ||
                    arrow.to_task.task.id === bar.task.id
                );
            });
        }
    }

    set_width() {
        const cur_width = this.$svg.getBoundingClientRect().width;
        const actual_width = this.$svg
            .querySelector('.grid .grid-row')
            .getAttribute('width');
        if (cur_width < actual_width) {
            this.$svg.setAttribute('width', actual_width);
        }
    }

    set_scroll_position() {
        const parent_element = this.$svg.parentElement;
        if (!parent_element) return;

        const hours_before_first_task = date_utils.diff(
            this.get_oldest_starting_date(),
            this.gantt_start,
            'hour'
        );

        const scroll_pos =
            hours_before_first_task /
                this.options.step *
                this.options.column_width -
            this.options.column_width;

        parent_element.scrollLeft = scroll_pos;
    }

    bind_grid_click() {
        this.layers.grid.onclick = () => {
            this.unselect_all();
            this.hide_popup();
        };
    }

    bind_bar_events() {
        let is_dragging = false;
        let x_on_start = 0;
        let y_on_start = 0;
        let is_resizing_left = false;
        let is_resizing_right = false;
        let parent_bar_id = null;
        let parent_bar_type = null;
        let bars = []; // instanceof Bar
        this.bar_being_dragged = null;

        function action_in_progress() {
            return is_dragging || is_resizing_left || is_resizing_right;
        }

        $.on(
            this.layers.bar,
            'mousedown',
            '.bar-wrapper, .handle',
            (e, element) => {
                const bar_wrapper = $.closest('.bar-wrapper', element);

                if (element.classList.contains('left')) {
                    is_resizing_left = true;
                } else if (element.classList.contains('right')) {
                    is_resizing_right = true;
                } else if (element.classList.contains('bar-wrapper')) {
                    is_dragging = true;
                }

                parent_bar_type = bar_wrapper.getAttribute('class');
                bar_wrapper.classList.add('active');

                x_on_start = e.offsetX;
                y_on_start = e.offsetY;

                parent_bar_id = bar_wrapper.getAttribute('data-id');

                const ids = [
                    parent_bar_id,
                    ...this.get_all_dependent_tasks(parent_bar_id)
                ];
                bars = ids.map(id => this.get_bar(id));

                this.bar_being_dragged = parent_bar_id;

                bars.forEach(bar => {
                    const $bar = bar.$bar;
                    $bar.ox = $bar.getX();
                    $bar.oy = $bar.getY();
                    $bar.owidth = $bar.getWidth();
                    $bar.finaldx = 0;
                });
            }
        );

        $.on(this.$svg, 'mousemove', e => {
            if (!action_in_progress()) return;
            const dx = e.offsetX - x_on_start;
            const dy = e.offsetY - y_on_start;

            bars.forEach(bar => {
                const $bar = bar.$bar;
                $bar.finaldx = this.get_snap_position(dx);

                const bar_type = bar.group.getAttribute('class');

                if (is_resizing_left) {
                    if (parent_bar_id === bar.task.id) {
                        bar.update_bar_position({
                            x: $bar.ox + $bar.finaldx,
                            width: $bar.owidth - $bar.finaldx
                        });
                    }
                } else if (is_resizing_right) {
                    if (parent_bar_id === bar.task.id) {
                        bar.update_bar_position({
                            width: $bar.owidth + $bar.finaldx
                        });
                    } else if (parent_bar_type == bar_type) {
                        bar.update_bar_position({
                            x: $bar.ox + $bar.finaldx
                        });
                    }
                } else if (is_dragging) {
                    if (parent_bar_id === bar.task.id) {
                        bar.update_bar_position({
                            x: $bar.ox + $bar.finaldx
                        });
                    } else if (parent_bar_type == bar_type) {
                        bar.update_bar_position({
                            x: $bar.ox + $bar.finaldx
                        });
                    }
                }
            });
        });

        document.addEventListener('mouseup', e => {
            if (is_dragging || is_resizing_left || is_resizing_right) {
                bars.forEach(bar => bar.group.classList.remove('active'));
            }

            is_dragging = false;
            is_resizing_left = false;
            is_resizing_right = false;
        });

        $.on(this.$svg, 'mouseup', e => {
            this.bar_being_dragged = null;
            bars.forEach(bar => {
                const $bar = bar.$bar;
                if (!$bar.finaldx) return;
                bar.date_changed();
                bar.set_action_completed();
            });
        });

        this.bind_bar_progress();
    }

    bind_bar_progress() {
        let x_on_start = 0;
        let y_on_start = 0;
        let is_resizing = null;
        let bar = null;
        let $bar_progress = null;
        let $bar = null;

        $.on(this.$svg, 'mousedown', '.handle.progress', (e, handle) => {
            is_resizing = true;
            x_on_start = e.offsetX;
            y_on_start = e.offsetY;

            const $bar_wrapper = $.closest('.bar-wrapper', handle);
            const id = $bar_wrapper.getAttribute('data-id');
            bar = this.get_bar(id);

            $bar_progress = bar.$bar_progress;
            $bar = bar.$bar;

            $bar_progress.finaldx = 0;
            $bar_progress.owidth = $bar_progress.getWidth();
            $bar_progress.min_dx = -$bar_progress.getWidth();
            $bar_progress.max_dx = $bar.getWidth() - $bar_progress.getWidth();
        });

        $.on(this.$svg, 'mousemove', e => {
            if (!is_resizing) return;
            let dx = e.offsetX - x_on_start;
            let dy = e.offsetY - y_on_start;

            if (dx > $bar_progress.max_dx) {
                dx = $bar_progress.max_dx;
            }
            if (dx < $bar_progress.min_dx) {
                dx = $bar_progress.min_dx;
            }

            const $handle = bar.$handle_progress;
            $.attr($bar_progress, 'width', $bar_progress.owidth + dx);
            $.attr($handle, 'points', bar.get_progress_polygon_points());
            $bar_progress.finaldx = dx;
        });

        $.on(this.$svg, 'mouseup', () => {
            is_resizing = false;
            if (!($bar_progress && $bar_progress.finaldx)) return;
            bar.progress_changed();
            bar.set_action_completed();
        });
    }

    get_all_dependent_tasks(task_id) {
        let out = [];
        let to_process = [task_id];
        while (to_process.length) {
            const deps = to_process.reduce((acc, curr) => {
                acc = acc.concat(this.dependency_map[curr]);
                return acc;
            }, []);

            out = out.concat(deps);
            to_process = deps.filter(d => !to_process.includes(d));
        }

        return out.filter(Boolean);
    }

    get_snap_position(dx) {
        let odx = dx,
            rem,
            position;

        if (this.view_is('Week')) {
            rem = dx % (this.options.column_width / 7);
            position =
                odx -
                rem +
                (rem < this.options.column_width / 14
                    ? 0
                    : this.options.column_width / 7);
        } else if (this.view_is('Month') || this.view_is('Max')) {
            rem = dx % (this.options.column_width / 30);
            position =
                odx -
                rem +
                (rem < this.options.column_width / 60
                    ? 0
                    : this.options.column_width / 30);
        } else {
            rem = dx % this.options.column_width;
            position =
                odx -
                rem +
                (rem < this.options.column_width / 2
                    ? 0
                    : this.options.column_width);
        }
        return position;
    }

    unselect_all() {
        [...this.$svg.querySelectorAll('.bar-wrapper')].forEach(el => {
            el.classList.remove('active');
        });
    }

    view_is(modes) {
        if (typeof modes === 'string') {
            return this.options.view_mode === modes;
        }

        if (Array.isArray(modes)) {
            return modes.some(mode => this.options.view_mode === mode);
        }

        return false;
    }

    get_task(id) {
        return this.tasks.find(task => {
            return task.id === id;
        });
    }

    get_bar(id) {
        return this.bars.find(bar => {
            return bar.task.id === id;
        });
    }

    show_popup(options) {
        if (!this.popup) {
            this.popup = new Popup(this.popup_wrapper);
        }
        this.popup.show(options);
    }

    hide_popup() {
        this.popup && this.popup.hide();
    }

    trigger_event(event, args) {
        if (this.options['on_' + event]) {
            this.options['on_' + event].apply(null, args);
        }
    }

    /**
     * Gets the oldest starting date from the list of tasks
     *
     * @returns Date
     * @memberof Gantt
     */
    get_oldest_starting_date() {
        return this.tasks
            .map(task => task._start)
            .reduce(
                (prev_date, cur_date) =>
                    cur_date <= prev_date ? cur_date : prev_date
            );
    }

    /**
     * Clear all elements from the parent svg element
     *
     * @memberof Gantt
     */
    clear() {
        this.$svg.innerHTML = '';
    }
}

function generate_id(item) {
    return (
        item.name +
        '_' +
        Math.random()
            .toString(36)
            .slice(2, 12)
    );
}
