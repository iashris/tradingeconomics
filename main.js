var margin = {
    top: window.innerHeight > window.innerWidth ? 0.3 * innerHeight : 100,
    bottom: 0,
    left: window.innerHeight > window.innerWidth ? 0 : 300,
    right: 0,
  },
  width = parseInt(d3.select(".viz").style("width")),
  width = width - margin.left - margin.right,
  mapRatio = 0.5,
  height = width * mapRatio,
  active = d3.select(null);

var svg = d3
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

Promise.resolve(d3.json("we.json")).then(ready);

var projection = d3
  .geoAlbersUsa()
  .scale(width)
  .translate([width / 2, height / 2]);

var path = d3.geoPath().projection(projection);

var g = svg
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
    .style("font-size", function (d) {
      // Scale the font size based on the state's area
      var size = Math.sqrt(path.area(d)) / 8;
      return size + "px"; // Adjust the constants as needed
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

  var bounds = path.bounds(d),
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
}

function reset(d) {
  console.log(d);
  active.classed("active", false);
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
