// need to create a flag class if more custom milestones are needed

import date_utils from './date_utils';
import { $, createSVG, animateSVG } from './svg_utils';

export default class Flag {
    constructor(gantt, milestone, bars_drawn) {
        this.set_defaults(gantt, milestone, bars_drawn);
        this.prepare();
        this.draw();
    }

    set_defaults(gantt, milestone, bars_drawn) {
        this.gantt = gantt;
        this.milestone = milestone;
        this.bars_drawn = bars_drawn;
    }

    prepare() {
        this.prepare_values();
        this.prepare_helpers();
    }

    prepare_values() {
        if (this.gantt.view_is('Hour')) {
            this.x =
                date_utils.diff(date_utils.start_of(this.milestone.date, 'hour'), this.gantt.gantt_start, 'hour') /
                this.gantt.options.step *
                this.gantt.options.column_width;
            this.y = 60;
            this.width = this.gantt.options.column_width / 7;

            this.height =
                (this.gantt.options.bar_height + this.gantt.options.padding) *
                    this.bars_drawn +
                this.gantt.options.header_height +
                this.gantt.options.padding / 2 - 60;
        } else if (this.gantt.view_is('Day')) {
            this.x =
                date_utils.diff(date_utils.start_of(this.milestone.date, 'day'), this.gantt.gantt_start, 'hour') /
                this.gantt.options.step *
                this.gantt.options.column_width;
            this.y = 60;
            this.width = this.gantt.options.column_width / 7;

            this.height =
                (this.gantt.options.bar_height + this.gantt.options.padding) *
                    this.bars_drawn +
                this.gantt.options.header_height +
                this.gantt.options.padding / 2 - 60;
        } else if (this.gantt.view_is('Week')) {
            this.x =
                date_utils.diff(date_utils.start_of(this.milestone.date, 'day'), this.gantt.gantt_start, 'hour') /
                this.gantt.options.step *
                this.gantt.options.column_width;
            this.y = 60;
            this.width = this.gantt.options.column_width / 7 / 3;

            this.height =
                (this.gantt.options.bar_height + this.gantt.options.padding) *
                    this.bars_drawn +
                this.gantt.options.header_height +
                this.gantt.options.padding / 2 - 60;
        } else if (this.gantt.view_is('Month') || this.gantt.view_is('Max')) {
            this.x =
                date_utils.diff(date_utils.start_of(this.milestone.date, 'day'), this.gantt.gantt_start, 'hour') /
                this.gantt.options.step *
                this.gantt.options.column_width;
            this.y = 60;
            this.width =
                this.gantt.options.column_width /
                date_utils.get_days_in_month(date_utils.start_of(this.milestone.date, 'day')) / 2;

            this.height =
                (this.gantt.options.bar_height + this.gantt.options.padding) *
                    this.bars_drawn +
                this.gantt.options.header_height +
                this.gantt.options.padding / 2 - 60;
        }

        this.group = createSVG('g', {
            class: 'milestones',
            'data-id': this.milestone.id
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
        this.draw_line();
        this.draw_flag();
        this.draw_label();
    }

    draw_line() {

        this.$line = createSVG('rect', {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            class: 'milestones',
            append_to: this.group
        });

        if (this.invalid) {
            this.$line.classList.add('bar-invalid');
        }
    }

    draw_flag() {
        if (this.invalid) return;

        this.$flag= createSVG('polygon', {
            points: this.get_flag_polygon_points(this.x).join(
                ','
            ),
            class: 'milestones',
            append_to: this.group
        });
    }

    draw_label() {
        this.$flag_label = createSVG('text', {
            x: this.x + 12,
            y: this.y,
            innerHTML: this.milestone.name,
            class: 'bar-label.big',
            append_to: this.group
        });
    }

    get_flag_polygon_points(x) {
        const y = this.$line.getY();
        const width = this.$line.getWidth();
        return [
            x,
            y,
            x - 3,
            y - 6,
            x + width / 2,
            y - 16,
            x + width + 3,
            y - 6,
            x + width,
            y
        ];
    }
}