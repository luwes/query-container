import { isQueryFullfilled, parseContainerQuery } from './parse-query';

const queryConditionCache = {};

declare global {
  interface Element {
    matchContainer: (containerQueryString: string) => { matches: boolean };
  }
}

Element.prototype.matchContainer = function (containerQueryString: string) {
  let query = queryConditionCache[containerQueryString];
  if (!query) {
    query = parseContainerQuery(containerQueryString).query;
    queryConditionCache[containerQueryString] = query;
  }
  const { width: inlineSize, height: blockSize } = this.getBoundingClientRect();
  return {
    matches: isQueryFullfilled(query.condition, { inlineSize, blockSize }),
  };
};

// It’s much better to create a single ResizeObserver that observes many elements.
// https://groups.google.com/a/chromium.org/g/blink-dev/c/z6ienONUb5A/m/F5-VcUZtBAAJ?pli=1
const ro = new ResizeObserver(function (entries) {
  entries.forEach(function (entry) {
    if (entry.target.hasAttribute('data-query-container')) {
      entry.target
        .querySelectorAll('container-query')
        .forEach((el: ContainerQuery) => {
          if (entry.target.matchContainer(el.query).matches) {
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

  connectedCallback() {
    const queryContainer = this.closest('[data-query-container]');
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
