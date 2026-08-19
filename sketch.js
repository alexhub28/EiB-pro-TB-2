function setup() {
  noCanvas();
  drawChart();
  window.addEventListener("resize", drawChart);
}

// 🎨 Mêmes teintes que le bar chart original de ce dossier : jaune
// (accent5) pour Einsatzbetriebe, lila (accent3) pour Einsatzplätze.
// Ici la couleur encode toujours la série, et son intensité (dégradé
// racine carrée) encode la valeur de la case dans son propre panneau.
const BASE_BETRIEBE = "#FCEB30";
const LIGHT_BETRIEBE = "#FEFACB";
const BASE_PLAETZE = "#A3A8CA";
const LIGHT_PLAETZE = "#EBECF3";

// --- Formatage suisse : 8'344 ---
function formatSwiss(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

function drawChart() {

  d3.select("#chart").selectAll("*").remove();

  const containerWidth = document.getElementById("chart").clientWidth;
  // Deux panneaux côte à côte ont besoin de place : sous 700px, on les
  // empile verticalement plutôt que de les écraser.
  const isMobile = containerWidth < 700;

  d3.csv("ABI_Einsatzbetriebe_und_Einsatzplaetze_nach_TB_2025.csv").then(raw => {

    const data = raw.map(d => ({
      label: d["Tätigkeit"],
      parts: d["Tätigkeit"].split(" / "),
      betriebe: +d["Einsatzbetriebe"],
      plaetze: +d["Einsatzplätze"]
    }));

    // ⭐ En mode empilé (écran étroit), les 2 panneaux se cumulent
    // verticalement : il faut des dimensions bien plus compactes que
    // côte à côte, sinon la hauteur totale explose le budget LivingDocs
    // (500px) — d'où titleHeight/panelHeight réduits spécifiquement ici.
    // ⭐ Titre trilingue sur UNE seule ligne (au lieu de 3, une par
    // langue) : ça libère de la hauteur, redonnée au treemap lui-même
    // (panelHeight) pour garder le même budget total qu'avant.
    const titleHeight = isMobile ? 24 : 26;
    const panelHeight = isMobile ? 179 : 308;
    const panelGap = isMobile ? 16 : 40;
    const panelWidth = isMobile ? containerWidth : (containerWidth - panelGap) / 2;

    const totalHeight = isMobile
      ? (titleHeight + panelHeight) * 2 + panelGap
      : titleHeight + panelHeight;

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", totalHeight);

    const PANELS = [
      {
        key: "betriebe",
        base: BASE_BETRIEBE,
        light: LIGHT_BETRIEBE,
        title: "Einsatzbetriebe / Établissements d'affectation / Istituti d'impiego",
        shortMetric: "Einsatzbetriebe"
      },
      {
        key: "plaetze",
        base: BASE_PLAETZE,
        light: LIGHT_PLAETZE,
        title: "Einsatzplätze / Places d'affectation / Posti d'impiego",
        shortMetric: "Einsatzplätze"
      }
    ];

    // --- Bulle flottante au survol, partagée par les deux panneaux ---
    // Ajoutée à la fin puis "raise()" à chaque affichage pour qu'elle
    // passe toujours au-dessus des cases du treemap (sinon elle reste
    // cachée derrière, comme dans la version précédente).
    const tooltip = svg.append("g").style("opacity", 0).style("pointer-events", "none");
    const tooltipRect = tooltip.append("rect")
      .attr("fill", "white")
      .attr("stroke", "#555")
      .attr("stroke-width", 1.2)
      .attr("rx", 5);
    const tooltipText = tooltip.append("text")
      .style("font-family", "Arial")
      .style("font-size", "13.5px")
      .style("fill", "#111");

    const padX = 10, padY = 8;

    function showTooltip(event, d, metricParts, color) {
      tooltip.raise();

      const [mx, my] = d3.pointer(event, svg.node());

      tooltipText.selectAll("tspan").remove();
      tooltipText.attr("x", padX).attr("y", 0);

      // ⭐ Contenu volontairement minimal : juste le nom du domaine
      // d'activité (3 langues) et le nombre — rien d'autre.
      d.data.parts.forEach((p, i) => {
        tooltipText.append("tspan")
          .attr("x", padX)
          .attr("dy", i === 0 ? 0 : "1.25em")
          .style("font-weight", "normal")
          .style("font-size", "12.5px")
          .text(p);
      });

      tooltipText.append("tspan")
        .attr("x", padX).attr("dy", "1.4em")
        .style("font-weight", "bold")
        .style("font-size", "13.5px")
        .style("fill", "#111")
        .text(formatSwiss(d.data.value));

      const bbox = tooltipText.node().getBBox();
      const boxW = bbox.width + padX * 2;
      const boxH = bbox.height + padY * 2;

      let tx = mx + 14;
      let ty = my - boxH - 12;
      if (tx + boxW > containerWidth) tx = mx - boxW - 14;
      if (ty < 0) ty = my + 14;

      tooltip.attr("transform", `translate(${tx}, ${ty})`);
      tooltipRect.attr("width", boxW).attr("height", boxH);
      tooltipText.attr("y", padY - bbox.y);
      tooltip.style("opacity", 1);
    }

    function hideTooltip() {
      tooltip.style("opacity", 0);
    }

    // --- Un panneau = un treemap (aire ∝ valeur) pour une série ---
    PANELS.forEach((p, pi) => {

      const tx = isMobile ? 0 : pi * (panelWidth + panelGap);
      const ty = isMobile ? pi * (titleHeight + panelHeight + panelGap) : 0;

      const panelG = svg.append("g").attr("transform", `translate(${tx}, ${ty})`);

      // Titre du panneau : puce + libellé trilingue sur UNE seule ligne
      // (pour gagner de la place, plutôt que 3 lignes empilées).
      const titleG = panelG.append("g");
      titleG.append("rect")
        .attr("width", 12).attr("height", 12).attr("y", 3)
        .attr("fill", p.base);

      const titleParts = p.title.split(" / ");

      titleG.append("text")
        .attr("x", 20)
        .attr("y", 13)
        .style("font-family", "Arial")
        .style("font-size", isMobile ? "11.5px" : "13.5px")
        .style("font-weight", "normal")
        .style("fill", "#111")
        .text(titleParts.join(" / "));

      // --- Calcul du treemap ---
      const root = d3.hierarchy({ children: data.map(d => ({ ...d, value: d[p.key] })) })
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);

      d3.treemap()
        .tile(d3.treemapSquarify)
        .size([panelWidth, panelHeight])
        .paddingInner(3)
        .round(true)(root);

      const maxVal = d3.max(data, d => d[p.key]);
      const colorScale = d3.scaleSqrt().domain([0, maxVal]).range([0, 1]);

      const nodeG = panelG.append("g")
        .attr("transform", `translate(0, ${titleHeight})`);

      const cell = nodeG.selectAll("g.cell")
        .data(root.leaves())
        .enter()
        .append("g")
        .attr("class", "cell")
        .attr("transform", d => `translate(${d.x0}, ${d.y0})`)
        .style("cursor", "pointer");

      cell.append("rect")
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .attr("fill", d => d3.interpolate(p.light, p.base)(colorScale(d.data.value)))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .style("opacity", 0)
        .transition()
        .delay((d, i) => i * 70)
        .duration(500)
        .ease(d3.easeCubicOut)
        .style("opacity", 1);

      // Libellé trilingue (une langue par ligne, aucune en gras) + valeur,
      // seulement si la case est assez grande — sinon, l'info reste
      // disponible au survol.
      const labelLineHeight = isMobile ? 10.5 : 12;
      const labelTopDy = isMobile ? 12.5 : 14.5;
      const labelBlockHeight = labelTopDy + 2 * labelLineHeight;
      const valueY = labelBlockHeight + (isMobile ? 13 : 15);

      const fitsLabel = d => (d.x1 - d.x0) > 64 && (d.y1 - d.y0) > labelBlockHeight + 8;
      const fitsValue = d => fitsLabel(d) && (d.y1 - d.y0) > valueY + 8;

      cell.filter(fitsLabel).each(function (d) {
        const labelG = d3.select(this).append("text")
          .attr("class", "tile-label")
          .style("font-family", "Arial")
          .style("fill", "#111")
          .style("opacity", 0);

        d.data.parts.forEach((part, i) => {
          labelG.append("tspan")
            .attr("x", 7)
            .attr("dy", i === 0 ? labelTopDy : labelLineHeight)
            .style("font-size", isMobile ? "10px" : "11px")
            .style("font-weight", "normal")
            .text(part);
        });

        labelG.transition()
          .delay(400)
          .duration(300)
          .style("opacity", 1);
      });

      cell.filter(fitsValue)
        .append("text")
        .attr("class", "tile-value")
        .attr("x", 7)
        .attr("y", valueY)
        .style("font-family", "Arial")
        .style("font-size", isMobile ? "11px" : "12.5px")
        .style("font-weight", "bold")
        .style("fill", "#111")
        .style("opacity", 0)
        .text("0")
        .transition()
        .delay((d, i) => i * 70 + 400)
        .duration(400)
        .style("opacity", 1)
        .textTween(function (d) {
          const iVal = d3.interpolateNumber(0, d.data.value);
          return t => formatSwiss(iVal(t));
        });

      // --- Survol : contour marqué + bulle avec le nom complet ---
      cell
        .on("mouseover", function (event, d) {
          d3.select(this).select("rect").attr("stroke", "#333").attr("stroke-width", 2.5);
          showTooltip(event, d, titleParts, p.base);
        })
        .on("mousemove", (event, d) => showTooltip(event, d, titleParts, p.base))
        .on("mouseout", function () {
          d3.select(this).select("rect").attr("stroke", "#fff").attr("stroke-width", 1.5);
          hideTooltip();
        });
    });
  });
}
