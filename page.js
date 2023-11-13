const socket = new WebSocket('ws://localhost:8081/ws');

const codeTextarea = document.getElementById("code");
const runButton = document.getElementById("runButton");
const nextButton = document.getElementById("nextButton");
const showButton = document.getElementById("showButton");
const jsonContainer = document.getElementById("formatted-json");
var svg;
var ul;
var simulation;
var provider;
let initialD3Graph = true;
let messageQueue = []; // Queue for storing JSON messages
let currentMessageIndex = 0; // Index of the message being processed

document.addEventListener("keydown", (event) => {
  if (event.key === "PageDown" || event.key == "PageUp") { 
    event.preventDefault(); // Prevents default key behavior
    sendJSON();
  }
});

runButton.addEventListener("click", sendJSON);

function sendJSON() {
    const code = codeTextarea.value;  // Get the contents of the text box
    const jsonPayload = { // Put the message in the right format
        type: "compile_program",
        program_to_compile: code
    };
    const jsonCode = JSON.stringify(jsonPayload); // Transforms the content of the text zone into JSON format
    console.log("Code to be sent:", jsonCode);  
    socket.send(jsonCode);  // Sends content to the server via WebSocket
    console.log("Code sent to server.");
    clearRulesNetworksMessages()
}

socket.addEventListener("message", (event) => {
  const jsonData = JSON.parse(event.data); // Recovers messages arriving via WebSocket
  messageQueue.push(jsonData); // Put messages in a list
  if (initialD3Graph){  
    initSimulationNetworks("processes-container"); // Initialise graphic zones
    initList("formatted-json");
    initialD3Graph = false;
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === " ") { 
    event.preventDefault(); 
    nextMessage()
    }
});

function nextMessage(){
  if (currentMessageIndex < messageQueue.length) {
    const nextMessage = messageQueue[currentMessageIndex];
    handleWebSocketMessage(nextMessage); // Process next message
    currentMessageIndex++;
    }
}

var lastprovider = null;
nextButton.addEventListener("click", nextMessage);  

function handleWebSocketMessage(jsonData){
    const transformedJson = processObject(jsonData, propertyMapping);
    const payload = transformedJson.payload; // Retrieve the necessary information from messages
    const rules = transformedJson.rules; 
    const nodes = payload.nodes;
      const links = payload.links;
    if (transformedJson.type === "processes_updated") {
      updateNetworks(nodes, links);
      updateList(nodes, lastprovider);
    }
    else if (transformedJson.type === "rules_updated") {
      updateRules(rules, "rules-container");
      lastprovider = lastProvider(rules);
      console.log(lastprovider);
    }  
}

function initSimulationNetworks(containerId){
  // Creating the SVG drawing area
  var width1 = 400;
  var height1 = 350;

  svg = d3.select(`#${containerId}`).append("svg")
    .attr("width", width1)
    .attr("height", height1)

  simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-800))
    .force("center", d3.forceCenter(height1 / 2, width1 / 2))
    // .force("collide", d3.forceCollide().strength(1.0))
    .force("x", d3.forceX(width1 / 2).strength(0.2))
    .force("y", d3.forceY(height1 / 2).strength(0.2))
    .force("gravity", d3.forceManyBody().strength(-800))
    .on("tick", ticked);

  // Create arrow
  svg.append("defs").append("marker")
    .attr("id", "arrowhead") 
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 12) 
    .attr("refY", 0)
    .attr("markerWidth", 5)
    .attr("markerHeight", 5) 
    .attr("orient", "auto") 
    .append("path")
    .attr("d", "M0,-5L10,0L0,5");

    svg.append("g").attr("class", "links");
    svg.append("g").attr("class", "nodes");
    svg.append("g").attr("class", "providers");
    svg.append("g").attr("class", "bodys");
}

function updateNetworks(nodes, links){
  // Creating links
  var linkElements = svg.select(".links").selectAll(".link")
  .data(links, d => d.id);

  linkElements.enter()
    .append("line")
    .attr("class", "link")
    .attr("stroke-width", 5)
    .style("stroke", "red")
    .attr("marker-end", "url(#arrowhead)");

  // Creating nodes
  var nodeElements = svg.select(".nodes").selectAll(".node")
    .data(nodes, d => d.id)

  nodeElements.enter()
    .append("circle")
    .attr("class", "node")  
    .attr("r", 10)
    .attr("fill", "orange")
    .attr("stroke", "yellow");

  // Providers
  var providers = svg.select(".providers").selectAll(".provider")
    .data(nodes, d => d.id)
  
  providers.enter()
    .append("text")
    .attr("class", "provider")
    .attr("fill", "white")
    .text(d => d.providers[0])

  // Body
  var body = svg.select(".bodys").selectAll(".body")
    .data(nodes, d => d.id)

  body.enter()
    .append("text")
    .attr("class", "body")
    .attr("fill", "white")
    .style("font-size", "12px")
    .text(d => d.body);
    
  nodeElements.exit().remove(); // Removes unnecessary items
  linkElements.exit().remove();
  providers.exit().remove();
  body.exit().remove();
  
  simulation.nodes(nodes);
  simulation.force("link").links(links);
  simulation.alphaTarget(0.1).restart();
}

function ticked() { // Position of elements
  var nodeElements = svg.select(".nodes").selectAll(".node");
  var linkElements = svg.select(".links").selectAll(".link");
  var providers = svg.select(".providers").selectAll(".provider");
  var body = svg.select(".bodys").selectAll(".body");

  linkElements
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

  nodeElements
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

  providers
      .attr("x", d => d.x + 10)
      .attr("y", d => d.y - 10);

  body
      .attr("x", d => d.x - 10)
      .attr("y", d => d.y + 22);
  }

function dragstarted(event) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  event.subject.fx = event.subject.x;
  event.subject.fy = event.subject.y;
}
  
// Update the subject (dragged node) position during drag.
function dragged(event) {
  event.subject.fx = event.x;
  event.subject.fy = event.y;
}
  
// Restore the target alpha so the simulation cools after dragging ends.
// Unfix the subject position now that it’s no longer being dragged.
function dragended(event) {
  if (!event.active) simulation.alphaTarget(0);
  event.subject.fx = null;
  event.subject.fy = null;
}

function updateRules(rules, containerId){

  d3.select(`#${containerId} svg`).remove();
  
  const width2 = 100;
  const height2 = 35;

  const heightModif = rules.length * height2; 

  const svg = d3.select(`#${containerId}`).append("svg")
    .attr("class", "graph-container")
    .attr("width", width2)
    .attr("height", heightModif);

  const ruleCases = svg.selectAll(".rule-case")
    .data(rules)
    .enter().append("g")
    .attr("class", "rule-case")
    .attr("transform", (d, i) => `translate(${width2 / 2}, ${i * 35 + 20})`);

  // Create a rectangle for the box
  ruleCases.append("rect") 
    .attr("x", -50)
    .attr("y", -20)
    .attr("width", 100)
    .attr("height", 30)
    .style("fill", "gray")

  // Adds the text of the rule inside the box
  ruleCases.append("text")
    .text(function(d) {return d.providers[0] + ": " + d.rule;})
    .attr("class", "rule-text")
    .attr("text-anchor", "middle")
    .style("fill", "gold");
}

// Mapping property names
const propertyMapping = {
  "processes": "nodes",
  "destination": "target"
};

// Function for renaming properties in an object
function renameProperties(obj, mapping) {
  const newObj = {};
  for (const key in obj) {
    if (mapping[key]) {
      newObj[mapping[key]] = obj[key];
    } else {
      newObj[key] = obj[key];
    }
  }
  return newObj;
}

// Recursive function for browsing and renaming properties
function processObject(obj, mapping) {
  if (typeof obj === "object" && obj !== null) {
    if (Array.isArray(obj)) {
      return obj.map(item => processObject(item, mapping));
    } else {
      const newObj = renameProperties(obj, mapping);
      for (const key in newObj) {
        newObj[key] = processObject(newObj[key], mapping);
      }
      return newObj;
    }
  }
  return obj;
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault(); 
    clearRulesNetworksMessages(); 
  }
});

function clearRulesNetworksMessages() {
  // Supprimer les réseaux
  d3.select("processes-container").selectAll('*').remove();
  
  // Supprimer les règles
  d3.select("#rules-container svg").remove();

  // Supprimer les scripts
  d3.select("formatted-json").selectAll('*').remove();
}

function removeCoordinates(jsonData) {
  if (typeof jsonData === "object" && jsonData !== null) {
    const cleanedJson = { ...jsonData }; 
    delete cleanedJson.x; 
    delete cleanedJson.y; 
    delete cleanedJson.vx; 
    delete cleanedJson.vy; 

    for (const key in cleanedJson) {
      cleanedJson[key] = removeCoordinates(cleanedJson[key]);
    }
    return cleanedJson;
  }
  return jsonData;
}

showButton.addEventListener("click", colorShow);

document.addEventListener("keydown", (event) => {
  if (event.key === "End") { 
    event.preventDefault(); 
    colorShow(); 
  }
});

function colorShow() { // Allows you to change the color of the buttons
    showButton.classList.toggle("green");
    showButton.classList.toggle("red");

    if (jsonContainer.style.display === "none" || jsonContainer.style.display === "") {
        // Si elle est cachée, montrez-la
        jsonContainer.style.display = "block";
    } else {
        // Sinon, cachez-la
        jsonContainer.style.display = "none";
    } 
}
var container;
function initList(containerId){
  ul = d3.select(`#${containerId}`).append("ul");;
}

function updateList(nodes, lastprovider) {
  // const cleanedJsonData = removeCoordinates(transformedJson);
  // const formattedJson = JSON.stringify(cleanedJsonData, null, 2);
  // jsonContainer.textContent = formattedJson;

// Bind data to existing DOM elements
var listItems = ul.selectAll('li')
  .data(nodes, d => d.id);

// Create new <li> elements if necessary
const newItems = listItems.enter()
  .append("li");

  console.log(lastprovider);
// Update the text of existing <li> elements
listItems.merge(newItems)
  .text(d => `prc[${d.providers}]: ${d.body}`)
  .attr("class", function(d) {
    if(d.providers === lastprovider) {
      return "highlighted";
    } else {
      return "";
    }
  });
  // .classed("highlighted", d => d.providers === lastprovider);

// Delete obsolete DOM elements
listItems.exit().remove();

// Ajouter de nouveaux éléments pour les nouvelles données
// listItems.enter()
//   .append('li')
//   .html(function(d) {
//     return d;
//   });
}

function lastProvider(rules) {  
  const lastRule = rules[rules.length - 1];
  const lastProvider = lastRule.providers[0];
  return lastProvider;
}