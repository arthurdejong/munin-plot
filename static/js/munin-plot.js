$(document).ready(function() {
  jQuery(function($) {
    var panelList = $('#draggablelist');
    panelList.sortable({
      handle: '.draghandle',
      update: function() {
        $('.panel', panelList).each(function(index, elem) {
          var $listItem = $(elem), newIndex = $listItem.index();
        });
      }
    });
  });
});
var default_colors = [
  '#00cc00', '#0066b3', '#ff8000', '#ffcc00', '#330099', '#990099',
  '#ccff00', '#ff0000', '#808080', '#008f00', '#00487d', '#b35a00',
  '#b38f00', '#6b006b', '#8fb300', '#b30000', '#bebebe', '#80ff80',
  '#80c9ff', '#ffc080', '#ffe680', '#aa80ff', '#ee00cc', '#ff8080',
  '#666600', '#ffbfff', '#00ffcc', '#cc6699', '#999900'];

var base_layout = {
  margin: { l: 48, t: 0, r: 32, b: 32 },
  autosize: true,
  showlegend: true,
  dragmode: 'zoom',
  selectdirection: 'h',
  xaxis: {
    tickfont: {
      size: 10,
      color: '#7f7f7f'
    }
  },
  yaxis: {
    fixedrange: true,
    tickfont: {
      size: 10,
      color: '#7f7f7f'
    },
    titlefont: {
      size: 10,
      color: '#7f7f7f'
    },
    exponentformat: 'SI'
  },
  legend: {
    bgcolor: '#ffffffa0',
    xanchor: 'auto',
    x: 1.2
  }
};

var config = {
  showLink: false,
  displaylogo: false,
  autosizable: true,
  responsive: true,
  scrollZoom: true,
  displayModeBar: false,
  modeBarButtonsToRemove: [
    'sendDataToCloud',
    'toImage',
    'lasso2d',
    'resetScale2d',
    'hoverClosestCartesian',
    'hoverCompareCartesian'
  ]
  // toImageButtonOptions
}

// make zoom levels consistent across graphs
function updateZoom(ed) {
  [].forEach.call(document.getElementsByClassName('myplot'), plot => {
    if (plot.layout) {
      let xaxis = plot.layout.xaxis;
      if ((ed['xaxis.range[0]'] && xaxis.range[0] != ed['xaxis.range[0]']) ||
          (ed['xaxis.range[1]'] && xaxis.range[1] != ed['xaxis.range[1]']) ||
          (ed['xaxis.autorange'] && ed['xaxis.autorange'] != xaxis.autorange))
        Plotly.relayout(plot, ed);
    }
  });
}

function htmlescape(text) {
  var p = document.createElement('p');
  p.appendChild(document.createTextNode(text));
  return p.innerHTML;
}

// load graph data into the plot
function loadGraph(plot, graph) {
  var traces = [];
  var tracebyfield = {};
  var stackgroup = 0;
  // prepare the graph configuration
  var layout = JSON.parse(JSON.stringify(base_layout));
  if (graph.graph_vlabel)
    layout.yaxis.title = graph.graph_vlabel;
  if (graph.graph_args && graph.graph_args.match(/--logarithmic/)) {
    layout.yaxis.type = 'log';
    layout.yaxis.exponentformat = 'E';
  }
  // get x axis zoom from another plot
  var existingplot = document.querySelectorAll('#draggablelist .myplot')[0];
  if (existingplot && existingplot.layout && existingplot.layout.xaxis.range) {
    layout.xaxis.range = [existingplot.layout.xaxis.range[0], existingplot.layout.xaxis.range[1]];
  }
  // prepare the data series configuration
  for (var i = 0; i < graph.fields.length; i++) {
    var field = graph.fields[i];
    var color = field.colour ? '#' + field.colour : default_colors[i];
    if (field.draw == 'AREA' || field.draw == 'STACK' || field.draw == 'AREASTACK') {
      if (!field.draw.match(/STACK/) && graph.fields[i + 1].draw.match(/STACK/)) {
        stackgroup += 1;
      }
      var trace = {
        name: field.label || field.name,
        x: [],
        y: [],
        line: {width: 0},
        fillcolor: color + 'c0',
        hoverlabel: {bgcolor: color + 'c0'},
        stackgroup: 'stack' + stackgroup
      };
      traces.push(trace);
      tracebyfield[field.name] = trace;
    } else {
      var trace = {
        name: field.label || field.name,
        x: [],
        y: [],
        line: {color: color}
      };
      var trace_min = {
        x: [],
        y: [],
        showlegend: false,
        hoverinfo: 'skip',
        line: {width: 0}
      };
      var trace_max = {
        x: [],
        y: [],
        showlegend: false,
        hoverinfo: 'skip',
        line: {width: 0},
        fill: 'tonexty',
        fillcolor: color + '20'
      };
      traces.push(trace, trace_min, trace_max);
      tracebyfield[field.name] = trace;
      tracebyfield[field.name + '.min'] = trace_min;
      tracebyfield[field.name + '.max'] = trace_max;
    }
  }
  // fetch the data and plot it
  Plotly.d3.csv('data/' + graph.name, function(data) {
    for (var i = 0; i < data.length; i++) {
      row = data[i];
      time = row['time'];
      Object.keys(tracebyfield).forEach(function(field) {
        tracebyfield[field].x.push(time);
        tracebyfield[field].y.push(Number(row[field]));
      });
    }
    Plotly.react(plot, traces, layout, config);
    // have changes in zoom update other plots
    plot.on('plotly_relayout', function(ed) { updateZoom(ed) });
  });
}

function addGraph(graph, size='150px') {
  var clone = document.getElementById('template').firstElementChild.cloneNode(true);
  var plot = clone.getElementsByClassName('myplot')[0];
  plot.graph = graph;
  // update the graph info
  [].forEach.call(clone.querySelectorAll('.graphinfo .dropdown-menu'), em => {
    var info = '<tt class="dropdown-item">' + htmlescape(graph.group + '/' + graph.host) + '</tt>';
    info += '<h3 class="dropdown-item">' + graph.graph_title + '</h3>';
    if (graph.graph_info)
      info += '<div class="dropdown-item">' + htmlescape(graph.graph_info) + '</div>';
    em.innerHTML = info;
  });
  // set the size changing actions
  [].forEach.call(clone.getElementsByClassName('setsize'), button => {
    button.addEventListener('click', function() {
      if (button.getElementsByClassName('sizesm').length)
        plot.style.height = '150px';
      else if (button.getElementsByClassName('sizemd').length)
        plot.style.height = '200px';
      else if (button.getElementsByClassName('sizelg').length)
        plot.style.height = '250px';
      Plotly.relayout(plot, {});
    });
  });
  // set the wanted size
  plot.style.height = size;
  // set the close action
  [].forEach.call(clone.getElementsByClassName('closegraph'), button => {
    button.addEventListener('click', function() {
      Plotly.purge(plot);
      clone.parentNode.removeChild(clone);
    });
  });
  // load the graph data
  loadGraph(plot, graph);
  // show the graph
  document.getElementById('draggablelist').appendChild(clone);
}

// update the select widget to be able to list the known graphs
function updateSelect(graphs) {
  // make lists of groups, hosts and categories
  var hosts = {};
  var categories = [];
  for (var graph in graphs) {
    var parts = graph.split('/')
    if (!hosts[parts[0]])
      hosts[parts[0]] = []
    if (hosts[parts[0]].indexOf(parts[1]) < 0)
      hosts[parts[0]].push(parts[1]);
    if (graphs[graph].category && categories.indexOf(graphs[graph].category) < 0)
      categories.push(graphs[graph].category);
  }
  // update options in host selector
  var groups = Object.keys(hosts);
  groups.sort();
  var hostselect = document.getElementById('hostselect');
  for (var i = 0; i < groups.length; i++) {
    var group = groups[i];
    var groupelement = document.createElement('optgroup');
    groupelement.setAttribute('label', group);
    hosts[group].sort();
    for (var j = 0; j < hosts[group].length; j++) {
      var hostelement = document.createElement('option');
      hostelement.setAttribute('value', group + '/' + hosts[group][j]);
      hostelement.textContent = hosts[group][j];
      groupelement.appendChild(hostelement);
    }
    hostselect.appendChild(groupelement);
  }
  // update options in category selector
  categories.sort();
  var categoryselect = document.getElementById('categoryselect');
  for (var i = 0; i < categories.length; i++) {
    var categoryelement = document.createElement('option');
    categoryelement.setAttribute('value', categories[i]);
    categoryelement.textContent = categories[i];
    categoryselect.appendChild(categoryelement);
  }
  // build list of graphs
  var graphnames = Object.keys(graphs);
  graphnames.sort();
  // handler for updating the choices in the graph select
  function updateGraphList() {
    var host = hostselect.options[hostselect.selectedIndex].value;
    var category = categoryselect.options[categoryselect.selectedIndex].value;
    var graphselect = document.getElementById('graphselect');
    graphselect.innerHTML = '';
    graphnames.forEach(function(graph) {
      if (host && !graph.startsWith(host))
        return;
      if (category && graphs[graph].category != category)
        return;
      var graphelement = document.createElement('a');
      graphelement.setAttribute('href', '#');
      graphelement.setAttribute('class', 'list-group-item list-group-item-action');
      graphelement.setAttribute('data-toggle', 'collapse');
      graphelement.setAttribute('data-target', '#addgraph');
      graphelement.textContent = graphs[graph].graph_title || graph.split('/')[2];
      // add the host graph unless a host graph has been selected
      if (!host) {
        var hostelement = document.createElement('small');
        hostelement.textContent = graph.split('/')[1] + ' / ';
        graphelement.prepend(hostelement);
      }
      graphselect.appendChild(graphelement);
      graphelement.addEventListener('click', function() {
        addGraph(graphs[graph]);
      });
    });
  }
  hostselect.addEventListener('change', updateGraphList, false);
  categoryselect.addEventListener('change', updateGraphList, false);
  updateGraphList();
}

// load all graphs
var request = new XMLHttpRequest();
request.overrideMimeType('application/json');
request.open('GET', 'graphs', true);
request.onreadystatechange = function () {
  if (request.readyState == 4 && request.status == '200') {
    var graphs = JSON.parse(request.responseText);
    addGraph(graphs['some.group/host.some.group/cpu']);
    addGraph(graphs['some.group/host.some.group/if_inet0']);
    addGraph(graphs['some.group/host.some.group/iostat_ios']);
    updateSelect(graphs);
  }
};
request.send(null);
