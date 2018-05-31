import date_utils from './date_utils';
import { $, createSVG, animateSVG } from './svg_utils';

export default class Bar {
    constructor(gantt, task) {
        this.set_defaults(gantt, task);
        this.prepare();
        this.draw();
        this.bind();
    }

    set_defaults(gantt, task) {
        this.action_completed = false;
        this.gantt = gantt;
        this.task = task;
    }

    prepare() {
        this.prepare_values();
        this.prepare_helpers();
    }

    prepare_values() {
        this.invalid = this.task.invalid;
        this.height = this.gantt.options.bar_height;
        this.x = this.compute_x();
        this.delay_start_x = this.compute_delay_start();
        this.overdue_x = this.compute_overdue_start();
        this.today_x = this.compute_today_x();
        this.y = this.compute_y();
        this.corner_radius = this.gantt.options.bar_corner_radius;
        console.log(this.gantt.options.view_mode);

        if (this.gantt.options.view_mode === 'Hour') {
            this.duration =
                date_utils.diff(this.task._end, this.task._start, 'hour') /
                this.gantt.options.step;
            this.delay_duration = Math.abs(
                date_utils.diff(
                    this.task._end_delay,
                    this.task._start_delay,
                    'hour'
                ) / this.gantt.options.step
            );
            this.overdue_duration = Math.abs(
                date_utils.diff(
                    this.task._end_overdue,
                    this.task._start_overdue,
                    'hour'
                ) / this.gantt.options.step
            );
        } else {
            this.duration =
                (date_utils.diff(this.task._end, this.task._start, 'hour') +
                    24) /
                this.gantt.options.step;
            this.delay_duration = Math.abs(
                (date_utils.diff(
                    this.task._end_delay,
                    this.task._start_delay,
                    'hour'
                ) +
                    24) /
                    this.gantt.options.step
            );
            this.overdue_duration = Math.abs(
                (date_utils.diff(
                    this.task._end_overdue,
                    this.task._start_overdue,
                    'hour'
                ) +
                    (this.task.has_overdue.wip ? 24 : 0)) /
                    this.gantt.options.step
            );
        }

        this.width = this.gantt.options.column_width * this.duration;
        this.delay_end_x = this.compute_delay_end();
        this.delay_width =
            this.gantt.options.column_width * this.delay_duration;
        this.overdue_width =
            this.gantt.options.column_width * this.overdue_duration;
        this.bar_class = this.compute_bar_class();
        this.bar_progress_class = this.compute_progress_bar_class();
        this.delay_start_cursor_class = this.compute_delay_start_cursor_class();
        this.delay_end_cursor_class = this.compute_delay_end_cursor_class();
        this.activity_start_cursor_class = this.compute_activity_start_cursor_class();
        this.activity_end_cursor_class = this.compute_activity_end_cursor_class();
        this.delay_bar_class = this.compute_delay_bar_class();
        this.overdue_bar_class = this.compute_overdue_bar_class();
        this.progress_width =
            this.gantt.options.column_width *
                this.duration *
                (this.task.progress / 100) || 0;
        this.completion_width =
            this.gantt.options.column_width *
                this.duration *
                (this.task.completion / 100) || 0;
        this.group = createSVG('g', {
            class: 'bar-wrapper ' + (this.task.custom_class || ''),
            'data-id': this.task.id
        });
        this.bar_group = createSVG('g', {
            class: 'bar-group',
            append_to: this.group
        });
        this.handle_group = createSVG('g', {
            class: 'handle-group',
            append_to: this.group
        });
    }

    prepare_helpers() {
        SVGElement.prototype.getX = function() {
            return +this.getAttribute('x');
        };
        SVGElement.prototype.getY = function() {
            return +this.getAttribute('y');
        };
        SVGElement.prototype.getWidth = function() {
            return +this.getAttribute('width');
        };
        SVGElement.prototype.getHeight = function() {
            return +this.getAttribute('height');
        };
        SVGElement.prototype.getEndX = function() {
            return this.getX() + this.getWidth();
        };
    }

    draw() {
        this.draw_bar();
        this.draw_overdue();
        this.draw_progress_bar();
        this.draw_completion_bar();
        this.draw_delay_start_cursor();
        this.draw_delay_end_cursor();
        this.draw_delay_bar();
        this.draw_label();
        this.draw_status();
        this.draw_resize_handles();

        this.draw_activity_cursor();
    }

    draw_bar() {
        this.$bar = createSVG('rect', {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: this.bar_class,
            append_to: this.bar_group
        });

        if (this.task.animate) animateSVG(this.$bar, 'width', 0, this.width, '0.4s', '0s');

        if (this.invalid) {
            this.$bar.classList.add('bar-invalid');
        }
    }

    draw_progress_bar() {
        if (this.invalid) return;
        this.$bar_progress = createSVG('rect', {
            x: this.x,
            y: this.y,
            width: this.progress_width,
            height: this.height,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: this.bar_progress_class,
            append_to: this.bar_group
        });

        if (this.task.animate) {
            animateSVG(this.$bar_progress, 'width', 0, 0, '0.4s', '0s');
            animateSVG(this.$bar_progress, 'width', 0, this.progress_width, '0.4s', '0.4s');
        }
    }

    draw_completion_bar() {
        if (this.invalid) return;
        this.$bar_completion = createSVG('rect', {
            x: this.x,
            y: this.y,
            width: this.completion_width,
            height: this.height,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: 'bar-completion',
            append_to: this.bar_group
        });

        if (this.task.animate) {
            animateSVG(this.$bar_completion, 'width', 0, 0, '0.4s', '0s');
            animateSVG(this.$bar_completion, 'width', 0, this.completion_width, '0.4s', '0.4s');
        }
    }

    draw_activity_cursor() {
        if (this.invalid || !this.x || (this.task.custom_class != "bar-activity" && this.task.custom_class != "bar-activity-overdue")) return;
        this.$cursor_activity_start = createSVG('polygon', {
            points: this.get_activity_cursor_polygon_points(
                this.x
            ).join(','),
            class: this.activity_start_cursor_class,
            append_to: this.bar_group
        });

        this.$cursor_activity_end = createSVG('polygon', {
            points: this.get_activity_cursor_polygon_points(
                this.x + this.width
            ).join(','),
            class: this.activity_end_cursor_class,
            append_to: this.bar_group
        });
    }

    get_activity_cursor_polygon_points(x) {
        const y = this.$bar.getY();
        const height = this.$bar.getHeight();
        return [
            x,
            y + height - 5,
            x,
            y + height + 8,
            x + (x > this.x ? -4 : 4),
            y + height + 8,
            x + (x > this.x ? -4 : 4),
            y + height - 5
        ];
    }

    draw_delay_start_cursor() {
        if (this.invalid || !this.delay_start_x) return;
        this.$cursor_delay_start = createSVG('polygon', {
            points: this.get_delay_cursor_polygon_points(
                this.delay_start_x
            ).join(','),
            class: this.delay_start_cursor_class,
            append_to: this.bar_group
        });
    }

    draw_delay_end_cursor() {
        if (this.invalid || !this.delay_end_x) return;
        this.$cursor_delay_end = createSVG('polygon', {
            points: this.get_delay_cursor_polygon_points(this.delay_end_x).join(
                ','
            ),
            class: this.delay_end_cursor_class,
            append_to: this.bar_group
        });
    }

    draw_delay_bar() {
        if (this.invalid || !(this.delay_start_x && this.delay_width)) return;
        this.$bar_delay = createSVG('rect', {
            x: this.delay_start_x,
            y: this.y,
            width: this.delay_width,
            height: this.height * 2 / 3,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: this.delay_bar_class,
            append_to: this.bar_group
        });
    }

    draw_overdue() {
        if (this.invalid || !(this.overdue_x && this.overdue_width)) return;
        this.$bar_overdue = createSVG('rect', {
            x: this.overdue_x,
            y: this.y,
            width: this.overdue_width,
            height: this.height,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: this.overdue_bar_class,
            append_to: this.bar_group
        });

        if (this.task.animate) {
            animateSVG(this.$bar_overdue, 'width', 0, 0, '0.8s', '0s');
            animateSVG(this.$bar_overdue, 'width', 0, this.overdue_width, '0.4s', '0.8s');
        }
    }

    draw_label() {

        var bar_label_class = this.task.animate ? 'bar-label-hidden' : 'bar-label';

        this.$bar_label = createSVG('text', {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2,
            innerHTML: this.task.name,
            class: bar_label_class,
            append_to: this.bar_group
        });

        if (this.task.animate) {
            animateSVG(this.$bar_label, 'opacity', 0, 0, '0.8s', '0s');
            animateSVG(this.$bar_label, 'opacity', 0, 1, '0.4s', '0.8s', 'freeze');
        }

        // labels get BBox in the next tick
        requestAnimationFrame(() => this.update_label_position());
    }

    draw_status() {
        this.$bar_status = createSVG('text', {
            x: this.x + 5,
            y: this.y - this.height / 4,
            innerHTML: this.task.status,
            class: 'bar-status',
            append_to: this.bar_group
        });
        // labels get BBox in the next tick
        requestAnimationFrame(() => this.update_status_position());
    }

    draw_resize_handles() {
        if (this.invalid) return;

        const bar = this.$bar;
        const handle_width = 8;

        createSVG('rect', {
            x: bar.getX() + bar.getWidth() - 9,
            y: bar.getY() + 1,
            width: handle_width,
            height: this.height - 2,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: 'handle right',
            append_to: this.handle_group
        });

        createSVG('rect', {
            x: bar.getX() + 1,
            y: bar.getY() + 1,
            width: handle_width,
            height: this.height - 2,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: 'handle left',
            append_to: this.handle_group
        });

        // // Uncomment to enable drag&drop on progress handle
        // if (this.task.progress && this.task.progress < 100) {
        //     this.$handle_progress = createSVG('polygon', {
        //         points: this.get_progress_polygon_points().join(','),
        //         class: 'handle progress',
        //         append_to: this.handle_group
        //     });
        // }
    }

    get_progress_polygon_points() {
        const bar_progress = this.$bar_progress;
        return [
            bar_progress.getEndX() - 5,
            bar_progress.getY() + bar_progress.getHeight(),
            bar_progress.getEndX() + 5,
            bar_progress.getY() + bar_progress.getHeight(),
            bar_progress.getEndX(),
            bar_progress.getY() + bar_progress.getHeight() - 8.66
        ];
    }

    get_delay_cursor_polygon_points(x) {
        const y = this.$bar.getY();
        const height = this.$bar.getHeight();
        return [
            x,
            y + height,
            x - 2,
            y + height,
            x - 2,
            y,
            x,
            y,
            x,
            y + height,
            x - 1,
            y + height,
            x - 4.75,
            y + height + 6.5,
            x + 2.75,
            y + height + 6.5,
            x - 1,
            y + height
        ];
    }

    bind() {
        if (this.invalid) return;
        this.setup_mouse_event();
    }

    setup_mouse_event() {
        $.on(this.group, 'click', e => {
            this.close_popup();
            this.gantt.unselect_all();
        });
        $.on(this.group, 'dblclick', e => {
            this.close_popup();
            this.gantt.trigger_event('click', [this.task]);
            this.gantt.unselect_all();
        });
        $.on(this.group, 'dragstart', e => {
            this.group.classList.toggle('dragged');
            this.$bar_overdue.style['pointer-events'] = 'none';
            this.$bar_delay.style['pointer-events'] = 'none';
            this.$cursor_delay_end.style['pointer-events'] = 'none';
            this.$cursor_delay_start.style['pointer-events'] = 'none';
        });
        $.on(this.group, 'dragend', e => {
            this.group.classList.remove('dragged');
            this.$bar_overdue.style['pointer-events'] = 'visiblePainted';
            this.$bar_delay.style['pointer-events'] = 'visiblePainted';
            this.$cursor_delay_end.style['pointer-events'] = 'visiblePainted';
            this.$cursor_delay_start.style['pointer-events'] = 'visiblePainted';
        });
        $.on(this.group, 'mouseover', e => {
            if (!this.group.classList.contains('dragged')) {
                this.show_popup();
                if (this.$cursor_delay_start)
                    this.$cursor_delay_start.style.visibility = 'visible';
                if (this.$cursor_delay_end)
                    this.$cursor_delay_end.style.visibility = 'visible';
                if (this.$bar_delay)
                    this.$bar_delay.style.visibility = 'visible';
                if (this.$bar_status)
                    this.$bar_status.style.visibility = 'visible';
                this.$bar_status.style.visibility = 'visible';
                this.handle_group.querySelector('.handle').style.opacity = '1';
                this.handle_group.querySelector('.handle.left').style.opacity = '1';
            }
        });
        $.on(this.group, 'mouseout', e => {
            this.close_popup();
            if (this.$cursor_delay_start)
                this.$cursor_delay_start.style.visibility = 'hidden';
            if (this.$cursor_delay_end)
                this.$cursor_delay_end.style.visibility = 'hidden';
            if (this.$bar_delay) this.$bar_delay.style.visibility = 'hidden';
            if (this.$bar_status) this.$bar_status.style.visibility = 'hidden';
            this.handle_group.querySelector('.handle').style.opacity = '0';
            this.handle_group.querySelector('.handle.left').style.opacity = '0';
        });
    }

    show_popup() {
        if (this.gantt.bar_being_dragged) return;

        const start_date = date_utils.format(this.task._start, 'MMM D');
        const end_date = date_utils.format(this.task._end, 'MMM D');
        const subtitle = 'Planned dates: ' + start_date + ' - ' + end_date;

        this.gantt.show_popup({
            target_element: this.$bar,
            title: this.task.name,
            subtitle: subtitle,
            info: this.task.info,
            position: 'left'
        });
    }

    close_popup() {
        this.gantt.hide_popup();
    }

    update_bar_position({ x = null, width = null }) {
        const bar = this.$bar;
        if (x) {
            // get all x values of parent task
            const xs = this.task.dependencies.map(dep => {
                return this.gantt.get_bar(dep).$bar.getX();
            });
            // child task must not go before parent
            const valid_x = xs.reduce((prev, curr) => {
                return x >= curr;
            }, x);
            if (!valid_x) {
                width = null;
                return;
            }
            this.update_attr(bar, 'x', x);
        }
        if (width && width >= this.gantt.options.column_width) {
            this.update_attr(bar, 'width', width);
        }
        this.update_label_position();
        this.update_status_position();
        this.update_handle_position();
        this.update_progressbar_position();
        this.update_overdue_position();
        this.update_completionbar_position();
        this.update_delaystartcursor_style();
        this.update_delayendcursor_style();
        this.update_delaybar_style();
        this.update_overduebar_style();
        this.update_arrow_position();
        this.update_activitycursor_position();
    }

    date_changed() {
        const { new_start_date, new_end_date } = this.compute_start_end_date();
        this.task._start = new_start_date;
        this.task._end = new_end_date;

        this.gantt.trigger_event('date_change', [
            this.task,
            new_start_date,
            new_end_date
        ]);
    }

    progress_changed() {
        const new_progress = this.compute_progress();
        this.task.progress = new_progress;
        this.gantt.trigger_event('progress_change', [this.task, new_progress]);
    }

    set_action_completed() {
        this.action_completed = true;
        setTimeout(() => (this.action_completed = false), 1000);
    }

    compute_start_end_date() {
        const bar = this.$bar;
        const x_in_units = bar.getX() / this.gantt.options.column_width;
        const new_start_date = date_utils.add(
            this.gantt.gantt_start,
            x_in_units * this.gantt.options.step,
            'hour'
        );
        const width_in_units = bar.getWidth() / this.gantt.options.column_width;
        const new_end_date = date_utils.add(
            new_start_date,
            width_in_units * this.gantt.options.step,
            'hour'
        );
        // lets say duration is 2 days
        // start_date = May 24 00:00:00
        // end_date = May 24 + 2 days = May 26 (incorrect)
        // so subtract 1 second so that
        // end_date = May 25 23:59:59
        date_utils.add(new_end_date, -1, 'second');
        return { new_start_date, new_end_date };
    }

    compute_progress() {
        const progress =
            this.$bar_progress.getWidth() / this.$bar.getWidth() * 100;
        return parseInt(progress, 10);
    }

    compute_completion() {
        const completion =
            this.$bar_completion.getWidth() / this.$bar.getWidth() * 100;
        return parseInt(completion, 10);
    }

    compute_x() {
        let x =
            date_utils.diff(this.task._start, this.gantt.gantt_start, 'hour') /
            this.gantt.options.step *
            this.gantt.options.column_width;

        if (this.gantt.view_is('Month') || this.gantt.view_is('Max')) {
            x =
                date_utils.diff(
                    this.task._start,
                    this.gantt.gantt_start,
                    'day'
                ) *
                this.gantt.options.column_width /
                30;
        }
        return x;
    }

    compute_delay_start() {
        let x =
            date_utils.diff(
                this.task._start_delay,
                this.gantt.gantt_start,
                'hour'
            ) /
            this.gantt.options.step *
            this.gantt.options.column_width;

        if (this.gantt.view_is('Month') || this.gantt.view_is('Max')) {
            x =
                date_utils.diff(
                    this.task._start_delay,
                    this.gantt.gantt_start,
                    'day'
                ) *
                this.gantt.options.column_width /
                30;
        }
        return x;
    }
    compute_overdue_start() {
        let x =
            date_utils.diff(
                this.task._start_overdue,
                this.gantt.gantt_start,
                'hour'
            ) /
            this.gantt.options.step *
            this.gantt.options.column_width;

        if (this.gantt.view_is('Month') || this.gantt.view_is('Max')) {
            x =
                date_utils.diff(
                    this.task._start_overdue,
                    this.gantt.gantt_start,
                    'day'
                ) *
                this.gantt.options.column_width /
                30;
        }
        return x;
    }

    compute_delay_end() {
        let x =
            (date_utils.diff(
                this.task._end_delay,
                this.gantt.gantt_start,
                'hour'
            ) +
                24) /
            this.gantt.options.step *
            this.gantt.options.column_width;

        if (this.gantt.view_is('Month') || this.gantt.view_is('Max')) {
            x =
                (date_utils.diff(
                    this.task._end_delay,
                    this.gantt.gantt_start,
                    'day'
                ) +
                    1) *
                this.gantt.options.column_width /
                30;
        }
        return x;
    }

    compute_bar_class() {
        var bar_class = 'bar';
        if (this.task.custom_class == "bar-activity" && this.task.has_overdue && (this.task.has_overdue.tostart || this.task.has_overdue.wip)) this.task.custom_class += "-overdue";
        return bar_class;
    }

    compute_progress_bar_class() {
        var progress_bar_class = 'bar-progress';
        return progress_bar_class;
    }

    compute_activity_start_cursor_class() {
        var activity_start_cursor_class = 'bar';
        if (this.task.completion > 0) activity_start_cursor_class = 'bar-completion';
        return activity_start_cursor_class;
    }

    compute_activity_end_cursor_class() {
        var activity_end_cursor_class = 'bar';
        if (this.task.completion >= 100) activity_end_cursor_class = 'bar-completion';
        return activity_end_cursor_class;
    }

    compute_delay_start_cursor_class() {
        var delay_start_cursor_class = 'no-delay';
        if (this.delay_start_x && !this.delay_width) {
            delay_start_cursor_class =
                this.delay_start_x - this.x > 0
                    ? 'cursor-delay-late'
                    : 'cursor-delay-in-time';
        }
        return delay_start_cursor_class;
    }

    compute_delay_end_cursor_class() {
        var delay_end_cursor_class = 'no-delay';
        if (this.delay_end_x && !(this.delay_start_x && this.delay_width)) {
            delay_end_cursor_class =
                this.delay_end_x - this.x - this.width > 0
                    ? 'cursor-delay-late'
                    : 'cursor-delay-in-time';
        }
        return delay_end_cursor_class;
    }

    compute_delay_bar_class() {
        var delay_bar_class = 'no-delay';
        if (this.delay_start_x && this.delay_width) {
            delay_bar_class =
                this.delay_start_x + this.delay_width - (this.x + this.width) >
                0
                    ? 'bar-delay-late'
                    : 'bar-delay-in-time';
        }
        return delay_bar_class;
    }

    compute_overdue_bar_class() {
        var overdue_bar_class = 'no-overdue';
        if (
            date_utils.diff(
                this.task._start_overdue,
                this.task._end,
                'hours'
            ) == 0
        ) {
            if (
                date_utils.diff(this.task._end, date_utils.today(), 'days') < 0
            ) {
                overdue_bar_class = 'overdue-indicator';
            }
        } else if (
            date_utils.diff(
                this.task._start_overdue,
                this.task._start,
                'hours'
            ) == 0
        ) {
            if (
                date_utils.diff(this.task._start, date_utils.today(), 'days') <
                0
            ) {
                overdue_bar_class = 'overdue-indicator';
            }
        }
        return overdue_bar_class;
    }

    compute_today_x() {
        const x =
            date_utils.diff(
                date_utils.today(),
                this.gantt.gantt_start,
                'hour'
            ) /
            this.gantt.options.step *
            this.gantt.options.column_width;
        return x;
    }

    compute_y() {
        return (
            this.gantt.options.header_height +
            this.gantt.options.padding +
            this.task._index * (this.height + this.gantt.options.padding)
        );
    }

    get_snap_position(dx) {
        let rr = dx,
            rem,
            position;

        if (this.gantt.view_is('Week')) {
            rem = dx % (this.gantt.options.column_width / 7);
            position =
                odx -
                rem +
                (rem < this.gantt.options.column_width / 14
                    ? 0
                    : this.gantt.options.column_width / 7);
        } else if (this.gantt.view_is('Month') || this.gantt.view_is('Max')) {
            rem = dx % (this.gantt.options.column_width / 30);
            position =
                odx -
                rem +
                (rem < this.gantt.options.column_width / 60
                    ? 0
                    : this.gantt.options.column_width / 30);
        } else {
            rem = dx % this.gantt.options.column_width;
            position =
                odx -
                rem +
                (rem < this.gantt.options.column_width / 2
                    ? 0
                    : this.gantt.options.column_width);
        }
        return position;
    }

    update_attr(element, attr, value) {
        value = +value;
        if (!isNaN(value)) {
            element.setAttribute(attr, value);
        }
        return element;
    }

    update_progressbar_position() {
        this.$bar_progress.setAttribute('x', this.$bar.getX());
        this.$bar_progress.setAttribute(
            'width',
            this.$bar.getWidth() * (this.task.progress / 100)
        );
    }
    update_overdue_position() {
        if (!this.$bar_overdue) return;
        if (this.gantt.view_is('Day')) {
            var one_day = this.gantt.options.column_width;
        } else if (this.gantt.view_is('Week')) {
            var one_day = this.gantt.options.column_width / 7;
        } else if (this.gantt.view_is('Month') || this.gantt.view_is('Max')) {
            var one_day = this.gantt.options.column_width / 30;
        }
        if (this.task.has_overdue.tostart) {
            this.$bar_overdue.setAttribute('x', this.$bar.getX());
            var new_width = this.today_x - this.$bar.getX();
            this.$bar_overdue.setAttribute(
                'width',
                new_width > 0 ? new_width : 0
            );
        } else {
            this.$bar_overdue.setAttribute(
                'x',
                this.$bar.getX() + this.$bar.getWidth() - 3
            );

            var HOUR_IN_MILLISECONDS = 3600000;
            var start_overdue = new Date((date_utils.diff(this.gantt.gantt_start, 0, 'hour') + (this.$bar.getX() + this.$bar.getWidth()) * this.gantt.options.step / this.gantt.options.column_width + 1) * HOUR_IN_MILLISECONDS );
            var new_width = this.gantt.options.column_width * (date_utils.diff(date_utils.today(), start_overdue, 'hour') + 24) / this.gantt.options.step + 3;

            this.$bar_overdue.setAttribute(
                'width',
                new_width > 0 ? new_width : 0
            );
        }
    }

    update_completionbar_position() {
        this.$bar_completion.setAttribute('x', this.$bar.getX());
        this.$bar_completion.setAttribute(
            'width',
            this.$bar.getWidth() * (this.task.completion / 100)
        );
    }

    update_activitycursor_position() {
        if (this.invalid || !this.x || (this.task.custom_class != "bar-activity" && this.task.custom_class != "bar-activity-overdue")) return;
        this.$cursor_activity_start.setAttribute('points', this.get_activity_cursor_polygon_points(this.$bar.getX()).join(','));
        this.$cursor_activity_end.setAttribute('points', this.get_activity_cursor_polygon_points(this.$bar.getX()).join(','));
    }

    update_delaystartcursor_style() {
        if (
            this.invalid ||
            !this.delay_start_x ||
            (this.delay_start_x && this.delay_width)
        )
            return;
        this.$cursor_delay_start.setAttribute(
            'class',
            this.delay_start_x - this.$bar.getX() > 0
                ? 'cursor-delay-late'
                : 'cursor-delay-in-time'
        );
    }

    update_delayendcursor_style() {
        if (
            this.invalid ||
            !this.delay_end_x ||
            (this.delay_start_x && this.delay_width)
        )
            return;
        this.$cursor_delay_end.setAttribute(
            'class',
            this.delay_end_x - this.$bar.getX() - this.$bar.getWidth() > 0
                ? 'cursor-delay-late'
                : 'cursor-delay-in-time'
        );
    }

    update_delaybar_style() {
        if (this.invalid || !(this.delay_start_x && this.delay_width)) return;
        this.$bar_delay.setAttribute(
            'class',
            this.delay_start_x +
                this.delay_width -
                (this.$bar.getX() + this.$bar.getWidth()) >
            0
                ? 'bar-delay-late'
                : 'bar-delay-in-time'
        );
    }

    update_overduebar_style() {
        if (!this.$bar_overdue) return;
        var overdue_bar_class = 'no-overdue';
        if (
            date_utils.diff(
                this.task._start_overdue,
                this.task._end,
                'hours'
            ) == 0
        ) {
            if (this.$bar.getX() + this.$bar.getWidth() - this.today_x < 0) {
                overdue_bar_class = 'overdue-indicator';
            }
        } else if (
            date_utils.diff(
                this.task._start_overdue,
                this.task._start,
                'hours'
            ) == 0
        ) {
            if (this.$bar.getX() - this.today_x < 0) {
                overdue_bar_class = 'overdue-indicator';
            }
        }
        this.$bar_overdue.setAttribute('class', overdue_bar_class);
    }

    update_label_position() {
        const bar = this.$bar,
            label = this.group.querySelector('.bar-label');
        if (label) {
            if (label.getBBox().width > bar.getWidth() - 16) {
                label.classList.add('big');
                label.setAttribute('x', bar.getX() + bar.getWidth() + 5);
            } else {
                label.classList.remove('big');
                label.setAttribute('x', bar.getX() + bar.getWidth() / 2);
            }
        }
    }

    update_status_position() {
        const bar = this.$bar,
            label = this.group.querySelector('.bar-status');

        if (label.getBBox().width > bar.getWidth() - 16) {
            label.classList.add('big');
            label.setAttribute('x', bar.getX() + 0);
        } else {
            label.classList.remove('big');
            label.setAttribute('x', bar.getX() + 5);
        }
    }

    update_handle_position() {
        const bar = this.$bar;
        this.handle_group
            .querySelector('.handle.left')
            .setAttribute('x', bar.getX() + 1);
        this.handle_group
            .querySelector('.handle.right')
            .setAttribute('x', bar.getEndX() - 9);
        const handle = this.group.querySelector('.handle.progress');
        handle &&
            handle.setAttribute('points', this.get_progress_polygon_points());
    }

    update_arrow_position() {
        this.arrows = this.arrows || [];
        for (let arrow of this.arrows) {
            arrow.update();
        }
    }
}

function isFunction(functionToCheck) {
    var getType = {};
    return (
        functionToCheck &&
        getType.toString.call(functionToCheck) === '[object Function]'
    );
}
