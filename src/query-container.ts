import { isQueryFullfilled, parseContainerQuery } from './parse-query';

// It’s much better to create a single ResizeObserver that observes many elements.
// https://groups.google.com/a/chromium.org/g/blink-dev/c/z6ienONUb5A/m/F5-VcUZtBAAJ?pli=1
const ro = new ResizeObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.target.hasAttribute('data-query-container')) {
      entry.target
        .querySelectorAll('container-query')
        .forEach((el: ContainerQuery) => {
          if (isQueryFullfilled(parseContainerQuery(el.query).query.condition, entry)) {
            el.setAttribute('active', '');
          } else {
            el.removeAttribute('active');
          }
        });
    }
  });
});

class ContainerQuery extends window.HTMLElement {
  static get observedAttributes() {
    return ['query'];
  }

  constructor() {
    super();
  }

  connectedCallback() {
    const queryContainer = this.closest(
      'query-container,[data-query-container]'
    );
    ro.unobserve(queryContainer);
    ro.observe(queryContainer);
  }

  attributeChangedCallback(attrName, oldValue, newValue) {
    if (attrName === 'query' && oldValue != newValue) {
      this.query = newValue;
    }
  }

  get query() {
    return this.getAttribute('query');
  }

  set query(val) {
    if (this.query === val) return;
    this.setAttribute('query', val);
  }
}

customElements.define('container-query', ContainerQuery);

export default ContainerQuery;
