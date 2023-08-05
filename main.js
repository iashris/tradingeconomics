const margin = {
  top: window.innerHeight > window.innerWidth ? 0.3 * innerHeight : 100,
  bottom: 0,
  left: window.innerHeight > window.innerWidth ? 0 : 300,
  right: 0,
};

let width = parseInt(d3.select(".viz").style("width"));
width = width - margin.left - margin.right;
const mapRatio = 0.5;
const height = width * mapRatio;
let active = d3.select(null);

document.getElementById("spinner").style.display = "none";

const svg = d3
  .select(".viz")
  .append("svg")
  .attr("class", "center-container")
  .attr("height", height + margin.top + margin.bottom)
  .attr("width", width + margin.left + margin.right);

svg
  .append("rect")
  .attr("class", "background center-container")
  .attr("height", height + margin.top + margin.bottom)
  .attr("width", width + margin.left + margin.right)
  .on("click", clicked);

Promise.resolve(d3.json("usa.json")).then(ready);

const tooltip = d3.select(".tooltip");

const projection = d3
  .geoAlbersUsa()
  .scale(width)
  .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

const g = svg
  .append("g")
  .attr("class", "center-container center-items us-state")
  .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom);

function ready(us) {
  g.append("g")
    .attr("id", "counties")
    .selectAll("path")
    .data(topojson.feature(us, us.objects.counties).features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("class", "county-boundary")
    .attr("data-county", function (d) {
      // Use the county's name as the key
      return d.properties.name;
    })
    .on("click", reset);

  g.append("g")
    .attr("id", "states")
    .selectAll("path")
    .data(topojson.feature(us, us.objects.states).features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("class", "state")
    .on("click", clicked);

  g.append("g")
    .attr("id", "state-labels")
    .selectAll("text")
    .data(topojson.feature(us, us.objects.states).features)
    .enter()
    .append("text")
    .attr("x", function (d) {
      return path.centroid(d)[0];
    })
    .attr("y", function (d) {
      console.log(d);
      return path.centroid(d)[1];
    })
    .attr("text-anchor", "middle")
    .style("font-family", "Arial")
    .style("pointer-events", "none")
    .style("font-size", function (d) {
      // Scale the font size based on the state's area
      const size = Math.sqrt(path.area(d)) / 8;
      return size + "px";
    })
    .text(function (d) {
      return d.properties.name;
    });

  g.append("path")
    .datum(
      topojson.mesh(us, us.objects.states, function (a, b) {
        return a !== b;
      })
    )
    .attr("id", "state-borders")
    .attr("d", path);
}

function clicked(d) {
  console.log(d);
  if (d3.select(".background").node() === this) return reset(d);

  if (active.node() === this) return reset(d);

  active.classed("active", false);
  active = d3.select(this).classed("active", true);

  const bounds = path.bounds(d),
    dx = bounds[1][0] - bounds[0][0],
    dy = bounds[1][1] - bounds[0][1],
    x = (bounds[0][0] + bounds[1][0]) / 2,
    y = (bounds[0][1] + bounds[1][1]) / 2,
    scale =
      0.9 /
      Math.max(
        dx / (width - margin.left - margin.right),
        dy / (height - margin.top - margin.bottom)
      ),
    translate = [
      (width - margin.left - margin.right) / 2 - scale * x + margin.left,
      (height - margin.top - margin.bottom) / 2 - scale * y + margin.top,
    ];

  g.transition()
    .duration(750)
    .style("stroke-width", 1.5 / scale + "px")
    .attr("transform", "translate(" + translate + ")scale(" + scale + ")");

  g.selectAll("#state-labels text")
    .transition()
    .duration(750)
    .style("opacity", 0);

  const stateName = d.properties.name.toLowerCase();

  // Make the API call
  document.getElementById("spinner").style.display = "block";

  fetch(
    `https://api.tradingeconomics.com/fred/snapshot/county/${stateName}?c=56dff1ca3fc2429:6f6uy5sxw22qpk6&f=json`
  )
    .then((response) => response.json())
    .then((data) => {
      appendDropdown(data);
      document.getElementById("spinner").style.display = "none";

      const categories = [
        ...new Set(
          data.map((item) => {
            const category = item.Category;
            if (category.includes(" in ")) {
              return category.split(" in ")[0];
            } else if (category.includes(" for ")) {
              return category.split(" for ")[0];
            } else {
              return category;
            }
          })
        ),
      ];

      updateChloropleth(
        data.filter((d) => d.Category.split(" in ")[0] === categories[0])
      );
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
      document.getElementById("spinner").style.display = "none";
    });
}

function appendDropdown(data) {
  // Select the dropdown from the DOM
  const dropdown = d3.select("#data-selector");

  dropdown.style("opacity", "1");

  // Remove any previously rendered options
  dropdown.selectAll("option").remove();

  // Get all unique categories from the data
  const categories = [
    ...new Set(
      data.map((item) => {
        const category = item.Category;
        if (category.includes(" in ")) {
          return category.split(" in ")[0];
        } else if (category.includes(" for ")) {
          return category.split(" for ")[0];
        } else {
          return category;
        }
      })
    ),
  ];

  // Create new options for the dropdown
  dropdown
    .selectAll("option")
    .data(categories)
    .enter()
    .append("option")
    .attr("value", (d) => d)
    .text((d) => d);

  // Add an event listener for when the dropdown value changes
  dropdown.on("change", function () {
    const selectedCategory = this.value;
    const filteredData = data.filter(
      (item) =>
        item.Category.startsWith(selectedCategory + " in ") ||
        item.Category.startsWith(selectedCategory + " for ")
    );
    updateChloropleth(filteredData);
  });
}

function updateChloropleth(data) {
  const minData = d3.min(data, (d) => d.Last);
  const maxData = d3.max(data, (d) => d.Last);
  const meanData = d3.mean(data, (d) => d.Last);

  const minCounty = data.find((d) => d.Last === minData).Country;
  const maxCounty = data.find((d) => d.Last === maxData).Country;

  // Update summary section
  d3.select("#summary").html(`
    <p>Max: ${maxData} (County: ${maxCounty})</p>
    <p>Min: ${minData} (County: ${minCounty})</p>
    <p>Mean: ${meanData}</p>
  `);

  // Define a color scale for the chloropleth
  const colorScale = d3
    .scaleSequential(d3.interpolateBlues)
    .domain([d3.min(data, (d) => d.Last), d3.max(data, (d) => d.Last)]);

  // Join the data to the counties
  const dataLookup = new Map(data.map((item) => [item.Country, item]));

  // Set the fill style for the counties
  g.select("#counties")
    .selectAll("path")
    .style("fill", (d) => {
      const item = dataLookup.get(d.properties.name);
      return item ? colorScale(item.Last) : "#ccc";
    });

  g.select("#counties")
    .selectAll("path")
    .on("mouseover", function (d) {
      // Find the corresponding item in the data
      const item = data.find((item) => item.Country === d.properties.name);
      if (item) {
        tooltip.transition().duration(200).style("opacity", 1);
        tooltip
          .html(item.Country + "<br/>" + item.Last)
          .style("left", d3.event.pageX + "px")
          .style("top", d3.event.pageY - 28 + "px");
      }
    })
    .on("mouseout", function (d) {
      tooltip.transition().duration(500).style("opacity", 0);
    });
}

function reset(d) {
  console.log(d);
  active.classed("active", false);
  d3.select("#data-selector").style("opacity", "0");
  active = d3.select(null);

  g.transition()
    .delay(100)
    .duration(750)
    .style("stroke-width", "1.5px")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  g.selectAll("#state-labels text")
    .transition()
    .duration(750)
    .style("opacity", 1);
}
