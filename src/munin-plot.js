/*!
  Copyright (C) 2018-2020 Arthur de Jong

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

require('./apple-touch-icon.png')
require('./favicon-16x16.png')
require('./favicon-32x32.png')
require('./favicon-64x64.png')
require('./favicon.ico')
require('bootstrap')
require('bootstrap/scss/bootstrap.scss')
require('jquery-ui/ui/widgets/draggable')
require('jquery-ui/ui/widgets/sortable')
require('daterangepicker')
require('daterangepicker/daterangepicker.css')
require('@fortawesome/fontawesome-free/js/all')
require('./munin-plot.css')

$(document).ready(function () {
  // make list of graphs draggable
  $('#draggablelist').sortable({
    handle: '.draghandle',
    start: function () {
      // hide and disable all tooltips
      $('.tooltip').tooltip('hide').tooltip('disable')
    },
    stop: function () {
      // enable tooltips again
      $('.tooltip').tooltip('enable')
    },
    update: function (event, ui) {
      // after any changes, save the current list of graphs
      saveCurrentGraphs()
    }
  })

  moment.fn.round10Minutes = function (how) {
    how = how || 'round'
    return this.minutes(Math[how](this.minutes() / 10) * 10).seconds(0).seconds(0).milliseconds(0)
  }

  // set the date range across graphs and date range picker
  function setDateRange(start, end) {
    // ensure start and end are moments
    if (typeof start !== 'object') {
      start = moment(start)
    }
    if (typeof end !== 'object') {
      end = moment(end)
    }
    // round times to 10 minute intervals
    start.round10Minutes('floor')
    end.round10Minutes('ceil')
    // update the date range picker
    var daterangepicker = $('#reportrange').data('daterangepicker')
    daterangepicker.setStartDate(start)
    daterangepicker.setEndDate(end)
    // ensure start and end are strings
    start = start.format('YYYY-MM-DD HH:mm')
    end = end.format('YYYY-MM-DD HH:mm')
    // update range for picker label
    $('#reportrange span').text(start + ' - ' + end)
    // update graphs as needed
    $('.myplot').each(function () {
      if (this.layout) {
        const xaxis = this.layout.xaxis
        if ((xaxis.range[0] !== start) || (xaxis.range[1] !== end)) {
          Plotly.relayout(this, {'xaxis.range': [start, end]})
        }
      }
    })
    // save date range in local storage
    localStorage.setItem('dateRange', JSON.stringify({start: start, end: end}))
  }

  // initialise the date range picker
  $('#reportrange').daterangepicker({
    locale: {
      format: 'YYYY-MM-DD HH:mm'
    },
    opens: 'left',
    timePicker: true,
    timePickerIncrement: 10,
    timePicker24Hour: true,
    showDropdowns: true,
    showCustomRangeLabel: false,
    alwaysShowCalendars: true,
    ranges: {
      Today: [moment().subtract(1, 'days').round10Minutes(), moment().add(1, 'hour').round10Minutes('ceil')],
      Yesterday: [moment().subtract(1, 'days').startOf('day'), moment().subtract(1, 'days').endOf('day').round10Minutes('ceil')],
      'Last 7 days': [moment().subtract(6, 'days').startOf('day'), moment().endOf('day').round10Minutes('ceil')],
      'Last 30 days': [moment().subtract(29, 'days').startOf('day'), moment().endOf('day').round10Minutes('ceil')],
      'This month': [moment().startOf('month'), moment().endOf('month').round10Minutes('ceil')],
      'Last month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month').round10Minutes('ceil')],
      'This year': [moment().subtract(365, 'days').startOf('month'), moment().endOf('month').round10Minutes('ceil')]
    }
  }, setDateRange)

  try {
    // restore the previously saved date range
    var data = JSON.parse(localStorage.getItem('dateRange'))
    setDateRange(data.start, data.end)
  } catch (error) {
    // set a default date range
    setDateRange(moment().subtract(2, 'days'), moment().add(1, 'hour').round10Minutes('ceil'))
  }

  var defaultColors = [
    '#00cc00', '#0066b3', '#ff8000', '#dbc300', '#330099', '#990099',
    '#bce617', '#ff0000', '#808080', '#008f00', '#00487d', '#b35a00',
    '#b38f00', '#6b006b', '#8fb300', '#b30000', '#bebebe', '#80ff80',
    '#80c9ff', '#ffc080', '#ffe680', '#aa80ff', '#ee00cc', '#ff8080',
    '#666600', '#ffbfff', '#00ffcc', '#cc6699', '#999900']

  var baseLayout = {
    margin: {l: 48, t: 0, r: 8, b: 32},
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
  }

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
  }

  // whether new data should be loaded
  var updatedata = false

  function htmlescape(text) {
    var p = document.createElement('p')
    p.appendChild(document.createTextNode(text))
    return p.innerHTML.replace(/'/g, '&quot;')
  }

  // update the legend
  function updateLegend(plot) {
    var [minx, maxx] = plot.layout.xaxis.range
    Object.keys(plot.legendbyfield).forEach(function (field) {
      var columns = plot.legendbyfield[field].getElementsByTagName('td')
      // calculate minimum
      var mintrace = plot.tracebyfield[field + '.min']
      var minvalue = Math.min.apply(null, mintrace.y.filter(function (el, idx) {
        var x = mintrace.x[idx]
        return x >= minx && x <= maxx
      }))
      // calculate average
      var avgtrace = plot.tracebyfield[field]
      if (avgtrace.y.length) {
        var avgvalue = avgtrace.y.map(function (current, idx) {
          var x = avgtrace.x[idx]
          if (idx > 0 && x >= minx && x <= maxx) {
            return [current, Date.parse(x) - Date.parse(avgtrace.x[idx - 1])]
          } else {
            return [current, 0]
          }
        }).reduce(function (acc, current, currentIndex, array) {
          return [acc[0] + (current[0] * current[1]), acc[1] + current[1]]
        })
        avgvalue = avgvalue[0] / avgvalue[1]
      } else {
        avgvalue = undefined
      }
      // calculate maximum
      var maxtrace = plot.tracebyfield[field + '.max']
      var maxvalue = Math.max.apply(null, maxtrace.y.filter(function (el, idx) {
        var x = maxtrace.x[idx]
        return x >= minx && x <= maxx
      }))
      // update legend
      columns[2].textContent = (isNaN(minvalue) || !isFinite(minvalue)) ? '-' : Plotly.d3.format('.4s')(minvalue)
      columns[3].textContent = (isNaN(avgvalue) || !isFinite(avgvalue)) ? '-' : Plotly.d3.format('.4s')(avgvalue)
      columns[4].textContent = (isNaN(maxvalue) || !isFinite(maxvalue)) ? '-' : Plotly.d3.format('.4s')(maxvalue)
    })
  }

  // load graph data into the plot
  function loadGraph(plot, legend, graph) {
    // prepare the graph configuration
    var layout = JSON.parse(JSON.stringify(baseLayout))
    if (graph.graph_vlabel) {
      layout.yaxis.title = graph.graph_vlabel
    }
    if (graph.graph_args && graph.graph_args.match(/--logarithmic/)) {
      layout.yaxis.type = 'log'
      layout.yaxis.exponentformat = 'E'
    }
    // get x axis zoom from date range selector
    var daterangepicker = $('#reportrange').data('daterangepicker')
    layout.xaxis.range = [
      daterangepicker.startDate.format('YYYY-MM-DD HH:mm'),
      daterangepicker.endDate.format('YYYY-MM-DD HH:mm')]
    // prepare the data series configuration
    var traces = []
    var tracebyfield = {}
    plot.tracebyfield = tracebyfield
    var stackgroup = 0
    for (var i = 0; i < graph.fields.length; i++) {
      var field = graph.fields[i]
      var color = field.colour ? '#' + field.colour : defaultColors[i % defaultColors.length]
      if (field.draw === 'AREA' || field.draw === 'STACK' || field.draw === 'AREASTACK') {
        if (!field.draw.match(/STACK/) && (!graph.fields[i + 1] || graph.fields[i + 1].draw.match(/STACK/))) {
          stackgroup += 1
        }
        var trace = {
          field_name: field.name,
          name: field.label || field.name,
          info: field.info || '',
          line: {width: 0},
          fillcolor: color + 'c0',
          hoverlabel: {bgcolor: color + 'c0'},
          stackgroup: 'stack' + stackgroup
        }
        traces.push(trace)
        tracebyfield[field.name] = trace
        tracebyfield[field.name + '.min'] = {}
        tracebyfield[field.name + '.max'] = {}
      } else if (field.draw) {
        trace = {
          field_name: field.name,
          name: field.label || field.name,
          info: field.info || '',
          line: {color: color},
          hoverlabel: {bgcolor: color + 'c0'}
        }
        var minTrace = {
          field_name: field.name,
          showlegend: false,
          hoverinfo: 'skip',
          line: {width: 0}
        }
        var maxTrace = {
          field_name: field.name,
          showlegend: false,
          hoverinfo: 'skip',
          line: {width: 0},
          fill: 'tonexty',
          fillcolor: color + '20'
        }
        traces.push(trace, minTrace, maxTrace)
        tracebyfield[field.name] = trace
        tracebyfield[field.name + '.min'] = minTrace
        tracebyfield[field.name + '.max'] = maxTrace
      }
    }
    // make placeholders for data in traces
    Object.keys(tracebyfield).forEach(function (field) {
      tracebyfield[field].x = []
      tracebyfield[field].y = []
    })
    // build the legend
    plot.legendbyfield = {}
    traces.slice().reverse().forEach(function (trace) {
      if (trace.showlegend !== false) {
        var legendrow = document.createElement('tr')
        var style
        if (trace.fillcolor) {
          style = 'stroke: ' + trace.fillcolor + ';stroke-width:8'
        } else {
          style = 'stroke: ' + trace.line.color + ';stroke-width:2'
        }
        legendrow.innerHTML += '<td style="width: 30px;"><svg height="10" width="20"><line x1="0" y1="5" x2="20" y2="5" style="' + style + '" /></svg></td>'
        legendrow.innerHTML += '<td><span title="' + htmlescape(trace.info) + '">' + htmlescape(trace.name) + '</span></td>'
        legendrow.innerHTML += '<td></td><td></td><td></td>'
        legend.getElementsByTagName('tbody')[0].appendChild(legendrow)
        plot.legendbyfield[trace.field_name] = legendrow
        // handle showing/hiding the trace
        legendrow.addEventListener('click', function () {
          var visible = (trace.visible === false)
          legendrow.style.opacity = visible ? 1 : 0.2
          plot.data.forEach(function (t) {
            if (t.field_name === trace.field_name) {
              t.visible = visible
            }
          })
          saveCurrentGraphs()
          Plotly.redraw(plot)
        })
        // highlight the trace by lowering the opacity of the others
        legendrow.addEventListener('mouseover', function () {
          if (plot.data) {
            var vals = plot.data.map(t => t.field_name === trace.field_name ? 1 : 0.1)
            Plotly.restyle(plot, 'opacity', vals)
            vals = plot.data.map(function (t) {
              if (t.showlegend === false) {
                return t.fillcolor
              }
              return (t.fillcolor || '#ffffff').substring(0, 7) + (t.field_name === trace.field_name ? 'ff' : '30')
            })
            Plotly.restyle(plot, 'fillcolor', vals)
          }
        })
      }
    })
    // reset opacity after exiting the legend
    legend.addEventListener('mouseout', function () {
      if (plot.data) {
        Plotly.restyle(plot, 'opacity', plot.data.map(t => 1))
        var vals = plot.data.map(function (t) {
          if (t.showlegend === false) {
            return t.fillcolor
          }
          return (t.fillcolor || '#ffffff').substring(0, 7) + 'c0'
        })
        Plotly.restyle(plot, 'fillcolor', vals)
      }
    })
    // fetch the data and plot it
    // TODO: probably skip this initial load???
    Plotly.d3.csv('data/' + graph.name, function (data) {
      for (var i = 0; i < data.length; i++) {
        var row = data[i]
        Object.keys(tracebyfield).forEach(function (field) {
          tracebyfield[field].x.push(row.time)
          tracebyfield[field].y.push(Number(row[field]))
        })
      }
      plot.innerHTML = ''
      Plotly.react(plot, traces, layout, config)
      updateLegend(plot)
      updatedata = true
      // handle plot changes
      plot.on('plotly_relayout', function (ed) {
        updatedata = true
        if (ed['xaxis.range[0]'] && ed['xaxis.range[1]']) {
          setDateRange(ed['xaxis.range[0]'], ed['xaxis.range[1]'])
        }
        // update the legend values
        updateLegend(plot)
      })
      // after any changes, save the current list of graphs
      saveCurrentGraphs()
    })
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
            var [amin, amax] = plot.layout.xaxis.range
            // range of the currently loaded data
            var dmin = plot.data.map(t => t.x[0]).reduce((a, c) => a < c ? a : c)
            var dmax = plot.data.map(t => t.x[t.x.length - 1]).reduce((a, c) => a > c ? a : c)
            // range that we have marked as loaded
            // (to avoid retrying to load data that isn't there)
            if (!plot.lmin) {
              plot.lmin = dmin
            }
            if (!plot.lmax) {
              plot.lmax = dmax
            }
            // see if we need to load data before the currently loaded range
            if (amin < plot.lmin) {
              plot.lmin = amin
              var url = 'data/' + plot.graph.name + '?start=' + amin.split('.')[0] + '&end=' + dmin.split('.')[0]
              Plotly.d3.csv(url, function (data) {
              // prepend new data
                if (data) {
                  for (var i = data.length - 1; i >= 0; i--) {
                    var row = data[i]
                    var time = row.time
                    Object.entries(plot.tracebyfield).forEach(function ([field, trace]) {
                      if (time < trace.x[0]) {
                        trace.x.splice(0, 0, time)
                        trace.y.splice(0, 0, Number(row[field]))
                      }
                    })
                  }
                  plot.layout.datarevision += 1
                  Plotly.react(plot, plot.data, plot.layout)
                }
              })
            }
            // see if we need to load data paste the currently loaded range
            if (amax > plot.lmax) {
              plot.lmax = amax
              // load data from dmax to amax and append
              url = 'data/' + plot.graph.name + '?start=' + dmax.split('.')[0] + '&end=' + amax.split('.')[0]
              Plotly.d3.csv(url, function (data) {
              // append new data
                if (data) {
                  for (var i = 0; i < data.length; i++) {
                    var row = data[i]
                    var time = row.time
                    Object.entries(plot.tracebyfield).forEach(function ([field, trace]) {
                      if (time > trace.x[trace.x.length - 1]) {
                        trace.x.push(time)
                        trace.y.push(Number(row[field]))
                      }
                    })
                  }
                  plot.layout.datarevision += 1
                  Plotly.react(plot, plot.data, plot.layout)
                }
              })
            }
          }
        })
      }
    } finally {
      setTimeout(checkDataUpdates, 1000)
    }
  }
  setTimeout(checkDataUpdates, 1000)

  // every minute check if there is any new data
  function checkNewData() {
    setTimeout(checkNewData, 60000);
    [].forEach.call(document.getElementsByClassName('myplot'), plot => {
      plot.lmax = undefined
    })
    updatedata = true
  }
  setTimeout(checkNewData, 60000)

  function addGraph(graph, size = 'sm') {
    var clone = document.getElementById('template').firstElementChild.cloneNode(true)
    var plot = clone.getElementsByClassName('myplot')[0]
    var legend = clone.getElementsByClassName('mylegend')[0]
    plot.graph = graph
    // update graph title
    $(clone).find('.graphtitle').text(graph.host + ' / ')
      .append($('<b>').text(graph.graph_title))
      .tooltip({title: graph.graph_info || ''})
    // tooltip for drag handle
    $(clone).find('.draghandle').tooltip({placement: 'right'})
    // set the size changing actions
    $(clone).find('.sizesm').tooltip({placement: 'right'}).click(function () {
      $(clone).find('.sizeactive').removeClass('sizeactive')
      $(this).addClass('sizeactive')
      $(plot).addClass('plot-sm').removeClass('plot-md plot-lg')
      $(legend).addClass('legend-sm').removeClass('legend-md legend-lg')
      Plotly.relayout(plot, {})
      saveCurrentGraphs()
    })
    $(clone).find('.sizemd').tooltip({placement: 'right'}).click(function () {
      $(clone).find('.sizeactive').removeClass('sizeactive')
      $(this).addClass('sizeactive')
      $(plot).addClass('plot-md').removeClass('plot-sm plot-lg')
      $(legend).addClass('legend-md').removeClass('legend-sm legend-lg')
      Plotly.relayout(plot, {})
      saveCurrentGraphs()
    })
    $(clone).find('.sizelg').tooltip({placement: 'right'}).click(function () {
      $(clone).find('.sizeactive').removeClass('sizeactive')
      $(this).addClass('sizeactive')
      $(plot).addClass('plot-lg').removeClass('plot-sm plot-md')
      $(legend).addClass('legend-lg').removeClass('legend-sm legend-md')
      Plotly.relayout(plot, {})
      saveCurrentGraphs()
    })
    // configure the close button
    $(clone).find('.closegraph').tooltip({placement: 'right'}).click(function () {
      $(this).tooltip('dispose')
      $(clone).hide(400, function () {
        Plotly.purge(plot)
        $(this).remove()
        // after any changes, save the current list of graphs
        saveCurrentGraphs()
      })
    })
    // set the wanted size
    $(plot).addClass('plot-' + size)
    $(legend).addClass('legend-' + size)
    $(clone).find('.sizeactive').removeClass('sizeactive')
    $(clone).find('.size' + size).addClass('sizeactive')
    // load the graph data
    loadGraph(plot, legend, graph)
    // enable tooltips on legend
    $(clone).find('.mylegend *[title]').tooltip({placement: 'bottom', container: 'body'})
    // show the graph
    document.getElementById('draggablelist').appendChild(clone)
    return plot
  }

  // update the select widget to be able to list the known graphs
  function updateSelect(graphs) {
    // make lists of groups, hosts and categories
    var hosts = {}
    var categories = []
    for (var graph in graphs) {
      var parts = graph.split('/')
      if (!hosts[parts[0]]) {
        hosts[parts[0]] = []
      }
      if (hosts[parts[0]].indexOf(parts[1]) < 0) {
        hosts[parts[0]].push(parts[1])
      }
      if (graphs[graph].category && categories.indexOf(graphs[graph].category) < 0) {
        categories.push(graphs[graph].category)
      }
    }
    // update options in host selector
    var groups = Object.keys(hosts)
    groups.sort()
    var hostselect = document.getElementById('hostselect')
    for (var i = 0; i < groups.length; i++) {
      var group = groups[i]
      var groupelement = document.createElement('optgroup')
      groupelement.setAttribute('label', group)
      hosts[group].sort()
      for (var j = 0; j < hosts[group].length; j++) {
        var hostelement = document.createElement('option')
        hostelement.setAttribute('value', group + '/' + hosts[group][j])
        hostelement.textContent = hosts[group][j]
        groupelement.appendChild(hostelement)
      }
      hostselect.appendChild(groupelement)
    }
    // update options in category selector
    categories.sort()
    var categoryselect = document.getElementById('categoryselect')
    for (i = 0; i < categories.length; i++) {
      var categoryelement = document.createElement('option')
      categoryelement.setAttribute('value', categories[i])
      categoryelement.textContent = categories[i]
      categoryselect.appendChild(categoryelement)
    }
    // build list of graphs
    var graphnames = Object.keys(graphs)
    graphnames.sort()
    var graphfilter = document.getElementById('graphfilter')
    // handler for updating the choices in the graph select
    function updateGraphList() {
      var host = hostselect.options[hostselect.selectedIndex].value
      var category = categoryselect.options[categoryselect.selectedIndex].value
      var search = graphfilter.value.toLowerCase().split(' ')
      var graphselect = document.getElementById('graphselect')
      graphselect.innerHTML = ''
      graphnames.forEach(function (graph) {
        if (host && !graph.startsWith(host)) {
          return
        }
        if (category && graphs[graph].category !== category) {
          return
        }
        var descripton = (graph + ' ' + graphs[graph].graph_title + ' ' + graphs[graph].category).toLowerCase()
        if (search.some(x => !descripton.includes(x))) {
          return
        }
        var graphelement = document.createElement('a')
        graphelement.setAttribute('href', '#')
        graphelement.setAttribute('class', 'list-group-item list-group-item-action')
        graphelement.setAttribute('data-toggle', 'collapse')
        graphelement.setAttribute('data-target', '#addgraph')
        graphelement.textContent = graphs[graph].graph_title || graph.split('/')[2]
        // add the host graph unless a host graph has been selected
        if (!host) {
          var hostelement = document.createElement('small')
          hostelement.textContent = graph.split('/')[1] + ' / '
          graphelement.prepend(hostelement)
        }
        graphselect.appendChild(graphelement)
        graphelement.addEventListener('click', function () {
          addGraph(graphs[graph])
        })
      })
      graphfilter.focus()
    }
    hostselect.addEventListener('change', updateGraphList, false)
    categoryselect.addEventListener('change', updateGraphList, false)
    graphfilter.addEventListener('input', updateGraphList, false)
    document.getElementsByClassName('addgraph')[0].getElementsByClassName('btn')[0].addEventListener('click', function () {
      setTimeout(function () {
        graphfilter.focus()
      }, 100)
    }, false)
    updateGraphList()
  }

  // return a list of currently shown graphs
  function getCurrentGraphs() {
    return $('.myplot').map(function () {
      if (this && this.layout) {
        return {
          name: this.graph.name,
          size: (function (graph) {
            if ($(graph).hasClass('plot-sm')) {
              return 'sm'
            } else if ($(graph).hasClass('plot-md')) {
              return 'md'
            } else if ($(graph).hasClass('plot-lg')) {
              return 'lg'
            }
          })(this),
          hidden: Object.entries(this.tracebyfield).filter(function ([field, trace]) {
            return trace.visible === false && trace.showlegend !== false
          }).map(function ([field, trace]) {
            return field
          })
        }
      }
    }).toArray()
  }

  // save the current graph status to local storage
  function saveCurrentGraphs() {
    localStorage.setItem('shownGraphs', JSON.stringify(getCurrentGraphs()))
  }

  // load information on available graphs
  $.getJSON('graphs', function (data) {
    updateSelect(data)
    // hide loading indicator and show normal interface
    $('.loadingrow').hide()
    $('.addgraph').show()
    $('nav .d-none').removeClass('d-none')
    // restore previous list of graphs
    try {
      JSON.parse(localStorage.getItem('shownGraphs')).forEach(function (graph) {
        // lookup the graph by name
        var plot = addGraph(data[graph.name], graph.size || 'sm')
        // hide fields
        if (graph.hidden && graph.hidden.length) {
          graph.hidden.forEach(function (field) {
            plot.tracebyfield[field].visible = false
            if (plot.tracebyfield[field + '.min']) {
              plot.tracebyfield[field + '.min'].visible = false
              plot.tracebyfield[field + '.min'].showlegend = false
              plot.tracebyfield[field + '.max'].visible = false
              plot.tracebyfield[field + '.max'].showlegend = false
            }
            plot.legendbyfield[field].style.opacity = 0.2
          })
        }
      })
    } catch (error) {}
  })
})
