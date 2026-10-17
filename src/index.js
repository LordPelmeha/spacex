import {SpaceX} from "./api/spacex";
import * as d3 from "d3";
import * as Geo from './geo.json'

document.addEventListener("DOMContentLoaded", setup)

let launchpadDots
let launchpadLabels

function setup(){
    const spaceX = new SpaceX();
    spaceX.launchpads().then(launchpads => {
        const listContainer = document.getElementById("listContainer")
        renderLaunches(launchpads, listContainer);
        drawMap(launchpads);
    })
}

function renderLaunches(launchpads, container){
    const list = document.createElement("ul");
    launchpads.forEach(launchpad => {
        launchpad.launches.forEach(name => {
            const item = document.createElement("li");
            item.className = "launch";
            item.innerHTML = name;
            item.dataset.launchpadId = launchpad.id;
            item.addEventListener("mouseenter", () => highlight(launchpad.id, true));
            item.addEventListener("mouseleave", () => highlight(launchpad.id, false));
            list.appendChild(item);
        })
    })
    container.replaceChildren(list);
}

function drawMap(launchpads){
    const width = 640;
    const height = 480;
    const margin = {top: 20, right: 10, bottom: 40, left: 100};
    const svg = d3.select('#map').append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");
    const projection = d3.geoMercator()
        .scale(70)
        .center([0,20])
        .translate([width / 2 - margin.left, height / 2]);

    const geoPath = d3.geoPath().projection(projection);

    svg.append("g")
        .selectAll("path")
        .data(Geo.features)
        .enter()
        .append("path")
        .attr("class", "topo")
        .attr("d", geoPath)
        .attr("fill", function (d) {
            return colorScale(0);
        })
        .style("opacity", .7)

    // Launchpad dots as GeoJSON Point features: coordinates are [longitude, latitude]
    const pointFeatures = launchpads.map(launchpad => ({
        type: "Feature",
        id: launchpad.id,
        name: launchpad.name,
        geometry: {
            type: "Point",
            coordinates: [launchpad.longitude, launchpad.latitude]
        }
    }));

    launchpadDots = svg.append("g")
        .selectAll("circle")
        .data(pointFeatures)
        .enter()
        .append("circle")
        .attr("class", "launchpad")
        .attr("r", 0)
        .attr("cx", d => {
            const p = projection(d.geometry.coordinates);
            return p ? p[0] : 0;
        })
        .attr("cy", d => {
            const p = projection(d.geometry.coordinates);
            return p ? p[1] : 0;
        })
        .attr("fill", "#e63946")

    launchpadDots.append("title").text(d => d.name);

    launchpadDots.transition().duration(600).attr("r", 6);

    launchpadLabels = svg.append("g")
        .selectAll("text")
        .data(pointFeatures)
        .enter()
        .append("text")
        .attr("class", "launchpad-label")
        .attr("x", d => {
            const p = projection(d.geometry.coordinates);
            return p ? p[0] + 8 : 0;
        })
        .attr("y", d => {
            const p = projection(d.geometry.coordinates);
            return p ? p[1] + 4 : 0;
        })
        .text(d => d.name)
}

function highlight(id, on){
    d3.selectAll(".launch").classed("active", false);
    d3.selectAll(".launch")
        .filter(function(){ return this.dataset.launchpadId === id })
        .classed("active", on);

    launchpadDots
        .classed("launchpad--active", false)
        .filter(d => d.id === id)
        .classed("launchpad--active", on)
        .transition().duration(150)
        .attr("r", on ? 12 : 6);

    launchpadLabels
        .filter(d => d.id === id)
        .classed("launchpad-label--active", on);
}

const colorScale = d3.scaleSequential(d3.interpolateRgb("#d0e3f0", "#1f4e79"));
