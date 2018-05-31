export default class Popup {
    constructor(parent) {
        this.parent = parent;
        this.make();
    }

    make() {
        this.parent.innerHTML = `
            <div class="title"></div>
            <div class="subtitle"></div>
            <div class="info"></div>
            <div class="pointer"></div>
        `;

        this.hide();

        this.title = this.parent.querySelector('.title');
        this.subtitle = this.parent.querySelector('.subtitle');
        this.info = this.parent.querySelector('.info');
        this.pointer = this.parent.querySelector('.pointer');
    }

    show(options) {
        if (!options.target_element) {
            throw new Error('target_element is required to show popup');
        }
        if (!options.position) {
            options.position = 'left';
        }
        const target_element = options.target_element;

        // set data
        this.title.innerHTML = options.title;
        this.subtitle.innerHTML = options.subtitle;
        this.info.innerHTML = options.info;

        this.parent.style.width = this.parent.clientWidth + 'px';
        this.parent.style['max-width'] = '300px';

        // set position
        let position_meta;
        if (target_element instanceof HTMLElement) {
            position_meta = target_element.getBoundingClientRect();
        } else if (target_element instanceof SVGElement) {
            position_meta = options.target_element.getBBox();
        }

        if (options.position === 'left') {
            this.parent.style.left =
                position_meta.x + (position_meta.width) - this.parent.clientWidth + 'px';
            this.parent.style.top =
                position_meta.y -
                this.title.clientHeight / 2 +
                position_meta.height / 2 +
                this.title.clientHeight +
                'px';

            this.pointer.style.transform = 'rotateZ(180deg)';
            this.pointer.style.left = this.parent.clientWidth - 5 + 'px';
            this.pointer.style.top =
                this.title.clientHeight / 2 -
                this.pointer.getBoundingClientRect().height -
                17 +
                'px';
        }

        // show
        this.parent.style.visibility = 'visible';
    }

    hide() {
        this.parent.style.visibility = 'hidden';
    }
}
