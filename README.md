# Query Container

Based on the code of [Surma](https://github.com/surma)'s https://github.com/GoogleChromeLabs/container-query-polyfill

The parent element that is observed for resizes has the `data-query-container` attribute.  
The `<container-query>` elements will get an active attribute when the [container query](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Container_Queries) is fulfilled.


```html
<div data-query-container>
  <container-query query="(width > 100px) and (width < 300px)">
    <button>Mobile Button</button>
  </container-query>
  <container-query query="(width >= 300px)" active>
    <button>Desktop Button</button>
  </container-query>
</div>
```
