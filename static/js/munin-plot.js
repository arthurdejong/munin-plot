/*
  Copyright (C) 2018 Arthur de Jong

  Permission is hereby granted, free of charge, to any person obtaining a
  copy of this software and associated documentation files (the "Software"),
  to deal in the Software without restriction, including without limitation
  the rights to use, copy, modify, merge, publish, distribute, sublicense,
  and/or sell copies of the Software, and to permit persons to whom the
  Software is furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
  DEALINGS IN THE SOFTWARE.
*/

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
  '#00cc00', '#0066b3', '#ff8000', '#dbc300', '#330099', '#990099',
  '#bce617', '#ff0000', '#808080', '#008f00', '#00487d', '#b35a00',
  '#b38f00', '#6b006b', '#8fb300', '#b30000', '#bebebe', '#80ff80',
  '#80c9ff', '#ffc080', '#ffe680', '#aa80ff', '#ee00cc', '#ff8080',
  '#666600', '#ffbfff', '#00ffcc', '#cc6699', '#999900'];

var base_layout = {
  margin: { l: 48, t: 0, r: 8, b: 32 },
  autosize: true,
  showlegend: false,
  dragmode: 'pan',
  selectdirection: 'h',
  xaxis: {
    type: 'date',
    tickfont: {
      size: 10,
      color: '#7f7f7f'
    },
    hoverformat: '%a %Y-%m-%d %H:%M'
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
    exponentformat: 'SI',
    hoverformat: '.4s'
  },
  legend: {
    bgcolor: '#ffffffa0',
    xanchor: 'auto',
    x: 1.2
  },
  datarevision: 1
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
  ],
  showTips: false
  // toImageButtonOptions
}

// whether new data should be loaded
var updatedata = false;

function htmlescape(text) {
  var p = document.createElement('p');
  p.appendChild(document.createTextNode(text));
  return p.innerHTML.replace(/"/g, '&quot;');
}

// update the legend
function updateLegend(plot, tracebyfield, legendbyfield) {
  var [minx, maxx] = plot.layout.xaxis.range;
  Object.keys(legendbyfield).forEach(function(field) {
    var columns = legendbyfield[field].getElementsByTagName('td');
    // calculate minimum
    var mintrace = tracebyfield[field + '.min'];
    var minvalue = Math.min.apply(null, mintrace.y.filter(function (el, idx) {
      var x = mintrace.x[idx];
      return x >= minx && x <= maxx;
    }));
    // calculate average
    var avgtrace = tracebyfield[field];
    var avgvalue = avgtrace.y.map(function (current, idx) {
      var x = avgtrace.x[idx];
      if (idx > 0 && x >= minx && x <= maxx)
        return [current, Date.parse(x) - Date.parse(avgtrace.x[idx - 1])];
      else
        return [current, 0];
    }).reduce(function(acc, current, currentIndex, array) {
      return [acc[0] + (current[0] * current[1]), acc[1] + current[1]];
    });
    avgvalue = avgvalue[0] / avgvalue[1];
    // calculate maximum
    var maxtrace = tracebyfield[field + '.max'];
    var maxvalue = Math.max.apply(null, maxtrace.y.filter(function (el, idx) {
      var x = maxtrace.x[idx];
      return x >= minx && x <= maxx;
    }));
    // update legend
    columns[2].textContent = (isNaN(minvalue) || !isFinite(minvalue)) ? '-' : Plotly.d3.format('.4s')(minvalue);
    columns[3].textContent = (isNaN(avgvalue) || !isFinite(avgvalue)) ? '-' : Plotly.d3.format('.4s')(avgvalue);
    columns[4].textContent = (isNaN(maxvalue) || !isFinite(maxvalue)) ? '-' : Plotly.d3.format('.4s')(maxvalue);
  });
}

// load graph data into the plot
function loadGraph(plot, legend, graph) {
  // prepare the graph configuration
  var layout = JSON.parse(JSON.stringify(base_layout));
  if (graph.graph_vlabel)
    layout.yaxis.title = graph.graph_vlabel;
  if (graph.graph_args && graph.graph_args.match(/--logarithmic/)) {
    layout.yaxis.type = 'log';
    layout.yaxis.exponentformat = 'E';
  }
  // get x axis zoom from another plot
  var existingplot = document.querySelector('#draggablelist .myplot');
  if (existingplot && existingplot.layout && existingplot.layout.xaxis.range) {
    layout.xaxis.range = [existingplot.layout.xaxis.range[0], existingplot.layout.xaxis.range[1]];
  }
  // prepare the data series configuration
  var traces = [];
  var tracebyfield = {};
  plot.tracebyfield = tracebyfield;
  var stackgroup = 0;
  for (var i = 0; i < graph.fields.length; i++) {
    var field = graph.fields[i];
    var color = field.colour ? '#' + field.colour : default_colors[i % default_colors.length];
    if (field.draw == 'AREA' || field.draw == 'STACK' || field.draw == 'AREASTACK') {
      if (!field.draw.match(/STACK/) && (!graph.fields[i + 1] || graph.fields[i + 1].draw.match(/STACK/))) {
        stackgroup += 1;
      }
      var trace = {
        field_name: field.name,
        name: field.label || field.name,
        info: field.info || '',
        line: {width: 0},
        fillcolor: color + 'c0',
        hoverlabel: {bgcolor: color + 'c0'},
        stackgroup: 'stack' + stackgroup
      };
      traces.push(trace);
      tracebyfield[field.name] = trace;
      tracebyfield[field.name + '.min'] = {};
      tracebyfield[field.name + '.max'] = {};
    } else {
      var trace = {
        field_name: field.name,
        name: field.label || field.name,
        info: field.info || '',
        line: {color: color},
        hoverlabel: {bgcolor: color + 'c0'}
      };
      var trace_min = {
        field_name: field.name,
        showlegend: false,
        hoverinfo: 'skip',
        line: {width: 0}
      };
      var trace_max = {
        field_name: field.name,
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
  // make placeholders for data in traces
  Object.keys(tracebyfield).forEach(function(field) {
    tracebyfield[field].x = [];
    tracebyfield[field].y = [];
  });
  // build the legend
  var legendbyfield = {};
  traces.slice().reverse().forEach(function(trace) {
    if (trace.showlegend != false) {
      var legendrow = document.createElement('tr')
      var style;
      if (trace.fillcolor)
        style = 'stroke: ' + trace.fillcolor + ';stroke-width:8';
      else
        style = 'stroke: ' + trace.line.color + ';stroke-width:2';
      legendrow.innerHTML += '<td style="width: 30px;"><svg height="10" width="20"><line x1="0" y1="5" x2="20" y2="5" style="' + style + '" /></svg></td>';
      legendrow.innerHTML += '<td><span title="' + htmlescape(trace.info) + '">' + htmlescape(trace.name) + '</span></td>';
      legendrow.innerHTML += '<td></td><td></td><td></td>';
      legend.getElementsByTagName('tbody')[0].appendChild(legendrow);
      legendbyfield[trace.field_name] = legendrow;
      // handle showing/hiding the trace
      legendrow.addEventListener('click', function() {
        visible = (trace.visible == false);
        legendrow.style.opacity = visible ? 1 : 0.2;
        plot.data.forEach(function(t) {
          if (t.field_name == trace.field_name)
            t.visible = visible;
        });
        Plotly.redraw(plot);
      });
      // highlight the trace by lowering the opacity of the others
      legendrow.addEventListener('mouseover', function() {
        var vals = plot.data.map(t => t.field_name == trace.field_name ? 1 : 0.1);
        Plotly.restyle(plot, 'opacity', vals);
        var vals = plot.data.map(function(t) {
          if (t.showlegend === false)
            return t.fillcolor;
          return (t.fillcolor || '#ffffff').substring(0, 7) + (t.field_name == trace.field_name ? 'ff' : '30');
        });
        Plotly.restyle(plot, 'fillcolor', vals);
      });
    }
  });
  // reset opacity after exiting the legend
  legend.addEventListener('mouseout', function() {
    Plotly.restyle(plot, 'opacity', plot.data.map(t => 1));
    var vals = plot.data.map(function(t) {
      if (t.showlegend === false)
        return t.fillcolor;
      return (t.fillcolor || '#ffffff').substring(0, 7) + 'c0';
    });
    Plotly.restyle(plot, 'fillcolor', vals);
  });
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
    plot.innerHTML = '';
    Plotly.react(plot, traces, layout, config);
    updateLegend(plot, tracebyfield, legendbyfield);
    updatedata = true;
    // handle plot changes
    plot.on('plotly_relayout', function(ed) {
      updatedata = true;
      // make zoom levels consistent across graphs
      [].forEach.call(document.getElementsByClassName('myplot'), plot => {
        if (plot.layout) {
          let xaxis = plot.layout.xaxis;
          if ((ed['xaxis.range[0]'] && xaxis.range[0] != ed['xaxis.range[0]']) ||
              (ed['xaxis.range[1]'] && xaxis.range[1] != ed['xaxis.range[1]']) ||
              (ed['xaxis.autorange'] && ed['xaxis.autorange'] != xaxis.autorange))
            Plotly.relayout(plot, ed);
        }
      });
      // update the legend values
      updateLegend(plot, tracebyfield, legendbyfield);
    });
  });
}

// check if the axis match the data range and load more data as needed
function checkDataUpdates() {
  try {
    if (updatedata) {
      updatedata = false;
      // go over all plots
      [].forEach.call(document.getElementsByClassName('myplot'), plot => {
        if (plot && plot.layout) {
          // range of the x axis
          var [amin, amax] = plot.layout.xaxis.range;
          // range of the currently loaded data
          var dmin = plot.data.map(t => t.x[0]).reduce((a, c) => a < c ? a : c);
          var dmax = plot.data.map(t => t.x[t.x.length - 1]).reduce((a, c) => a > c ? a : c);
          // range that we have marked as loaded
          // (to avoid retrying to load data that isn't there)
          if (!plot.lmin)
            plot.lmin = dmin;
          if (!plot.lmax)
            plot.lmax = dmax;
          // see if we need to load data before the currently loaded range
          if (amin < plot.lmin) {
            plot.lmin = amin;
            Plotly.d3.csv('data/' + plot.graph.name + '?start=' + amin.split('.')[0] + '&end=' + dmin.split('.')[0], function(data) {
              // prepend new data
              if (data) {
                for (var i = data.length - 1; i >= 0; i--) {
                  row = data[i];
                  time = row['time'];
                  Object.keys(plot.tracebyfield).forEach(function(field) {
                    var trace = plot.tracebyfield[field];
                    if (time < trace.x[0]) {
                      trace.x.splice(0, 0, time);
                      trace.y.splice(0, 0, Number(row[field]));
                    }
                  });
                }
                plot.layout.datarevision += 1;
                Plotly.react(plot, plot.data, plot.layout);
              }
            });
          }
          // see if we need to load data paste the currently loaded range
          if (amax > plot.lmax) {
            plot.lmax = amax;
            // load data from dmax to amax and append
            Plotly.d3.csv('data/' + plot.graph.name + '?start=' + dmax.split('.')[0] + '&end=' + amax.split('.')[0], function(data) {
              // append new data
              if (data) {
                for (var i = 0; i < data.length; i++) {
                  row = data[i];
                  time = row['time'];
                  Object.keys(plot.tracebyfield).forEach(function(field) {
                    var trace = plot.tracebyfield[field];
                    if (time > trace.x[trace.x.length - 1]) {
                      trace.x.push(time);
                      trace.y.push(Number(row[field]));
                    }
                  });
                }
                plot.layout.datarevision += 1;
                Plotly.react(plot, plot.data, plot.layout);
              }
            });
          }
        }
      });
    }
  } finally {
    setTimeout(checkDataUpdates, 1000);
  }
}
setTimeout(checkDataUpdates, 1000);

// every minute check if there is any new data
function checkNewData() {
  setTimeout(checkNewData, 60000);
  [].forEach.call(document.getElementsByClassName('myplot'), plot => {
    plot.lmax = undefined;
  });
  updatedata = true;
}
setTimeout(checkNewData, 60000);

function addGraph(graph, size='150px') {
  var clone = document.getElementById('template').firstElementChild.cloneNode(true);
  var plot = clone.getElementsByClassName('myplot')[0];
  var legend = clone.getElementsByClassName('mylegend')[0];
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
      if (button.getElementsByClassName('sizesm').length) {
        plot.style.height = '150px';
        legend.style.height = '150px';
      } else if (button.getElementsByClassName('sizemd').length) {
        plot.style.height = '200px';
        legend.style.height = '200px';
      } else if (button.getElementsByClassName('sizelg').length) {
        plot.style.height = '250px';
        legend.style.height = '250px';
      }
      Plotly.relayout(plot, {});
    });
  });
  // set the wanted size
  plot.style.height = size;
  legend.style.height = size;
  // set the close action
  [].forEach.call(clone.getElementsByClassName('closegraph'), button => {
    button.addEventListener('click', function() {
      Plotly.purge(plot);
      clone.parentNode.removeChild(clone);
    });
  });
  // load the graph data
  loadGraph(plot, legend, graph);
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
    updateSelect(graphs);
    document.getElementsByClassName('addgraph')[0].style.display = 'flex';
    document.getElementsByClassName('loadingrow')[0].style.display = 'none';
  }
};
request.send(null);
