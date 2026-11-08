# Portfolio

Personal site for Angel Gonzalez: a Cal Poly Pomona student exploring environmental science, GIS, and code. Plain HTML, CSS, and JavaScript. No build step.

## Pages

| File | What it is |
| --- | --- |
| `index.html` | Home: intro and links to the other pages |
| `about.html` | Bio with Skills / Experience / Education tabs |
| `gis-lab.html` | Live map: earthquakes (USGS), air quality for SoCal cities (Open-Meteo), click-anywhere air quality, switchable base maps |
| `projects.html` | Cards built from my public GitHub repos, with a language breakdown and filters |
| `contact.html` | Contact form (Formspree), email, GitHub, LinkedIn |

`style.css` and `script.js` are shared by every page.

## Project structure

```
index.html  about.html  gis-lab.html  projects.html  contact.html
style.css
script.js
assets/
  background.jpeg   home page header background
  young-face.jpeg   nav logo
  army.jpeg         about page photo
```

## Run locally

Use a local server (for example VS Code's Live Server), since the live data and contact form need a real web address rather than `file://`.

## Settings

At the top of `script.js`:

- `GITHUB_USER`: GitHub username used for the Projects page
- `HIDDEN_REPOS`: repo names to leave out
- `MAX_REPOS`: how many project cards to show
- `CITIES`: places shown as air quality pins (the first one feeds the "Air quality at Cal Poly Pomona" card)

Colors are variables at the top of `style.css`.

## Notes

- Base maps come from USGS The National Map and OpenStreetMap, neither of which needs an API key. (CARTO's free map tiles now require one, which is why they were removed.)
- GitHub's public API allows about 60 requests per hour per visitor. If it's unavailable, the Projects page shows a message and the "See all on GitHub" button still works.
- To publish for free, push this folder to a GitHub repo and turn on GitHub Pages.
