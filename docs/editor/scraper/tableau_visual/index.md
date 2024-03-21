# tableau_visual: Tableau Visualization

## Supported codes

### URL

```
https://public.tableau.com/views/AfricanAmericanMuseumsBack2VizBasics/AfricanAmericanMuseums?:language=en-US&:display_count=n&:origin=viz_share_link 
```

### Embed Post

```html
<div class='tableauPlaceholder' id='viz1677528023960' style='position: relative'><noscript><a href='#'><img alt='African American Museums ' src='https:&#47;&#47;public.tableau.com&#47;static&#47;images&#47;Af&#47;AfricanAmericanMuseumsBack2VizBasics&#47;AfricanAmericanMuseums&#47;1_rss.png' style='border: none' /></a></noscript><object class='tableauViz'  style='display:none;'><param name='host_url' value='https%3A%2F%2Fpublic.tableau.com%2F' /> <param name='embed_code_version' value='3' /> <param name='site_root' value='' /><param name='name' value='AfricanAmericanMuseumsBack2VizBasics&#47;AfricanAmericanMuseums' /><param name='tabs' value='no' /><param name='toolbar' value='yes' /><param name='static_image' value='https:&#47;&#47;public.tableau.com&#47;static&#47;images&#47;Af&#47;AfricanAmericanMuseumsBack2VizBasics&#47;AfricanAmericanMuseums&#47;1.png' /> <param name='animate_transition' value='yes' /><param name='display_static_image' value='yes' /><param name='display_spinner' value='yes' /><param name='display_overlay' value='yes' /><param name='display_count' value='yes' /><param name='language' value='en-US' /></object></div>                <script type='text/javascript'>                    var divElement = document.getElementById('viz1677528023960');                    var vizElement = divElement.getElementsByTagName('object')[0];                    vizElement.style.width='1200px';vizElement.style.height='1428px';                    var scriptElement = document.createElement('script');                    scriptElement.src = 'https://public.tableau.com/javascripts/api/viz_v1.js';                    vizElement.parentNode.insertBefore(scriptElement, vizElement);                </script> 
```

## Params

```ts
interface Params {
  id: string
  width?: number
  height?: number
}
```

## Data

```ts
interface Data {
  screenshots: Screenshot[]
  scrapedAt: DatetimeUTC
  url: string
  title: string
}

interface Screenshot {
  damId: DocId
  type: string
  width: number
  height: number
  contentType: string // e.g. image/png
}
```
