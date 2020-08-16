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
          Plotly.relayout(this, {'xaxis.range[0]': start, 'xaxis.range[1]': end})
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
      'This week': [moment().subtract(6, 'days').startOf('day'), moment().endOf('day').round10Minutes('ceil')],
      'This month': [moment().subtract(32, 'days').startOf('day'), moment().endOf('day').round10Minutes('ceil')],
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

  // update the legend
  function updateLegend(plot) {
    var [minx, maxx] = plot.layout.xaxis.range
    Object.keys(plot.legendbyfield).forEach(function (field) {
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
      var columns = $(plot.legendbyfield[field]).find('td')
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
    // if there are too many traces only hover on the nearest
    if (traces.filter(trace => trace.showlegend !== false).length > 6) {
      layout.hovermode = 'closest'
    }
    // build the legend
    plot.legendbyfield = {}
    traces.slice().reverse().forEach(function (trace) {
      if (trace.showlegend !== false) {
        var legendrow = $('<tr></tr>')
        legendrow.append($('<td style="width: 30px;"><svg height="10" width="20"><line x1="0" y1="5" x2="20" y2="5"></svg></td>'))
        legendrow.append($('<td><span></span></td>'))
        legendrow.append($('<td></td>'))
        legendrow.append($('<td></td>'))
        legendrow.append($('<td></td>'))
        if (trace.fillcolor) {
          legendrow.find('svg').attr('style', 'stroke: ' + trace.fillcolor + ';stroke-width:8')
        } else {
          legendrow.find('svg').attr('style', 'stroke: ' + trace.line.color + ';stroke-width:2')
        }
        legendrow.find('span').attr('title', trace.info).text(trace.name)
        legend.find('tbody').append(legendrow)
        plot.legendbyfield[trace.field_name] = legendrow[0]
        // handle showing/hiding the trace
        legendrow.click(function () {
          if (plot.data) {
            var visible = (trace.visible === false)
            $(this).css('opacity', visible ? 1 : 0.2)
            plot.data.forEach(function (t) {
              if (t.field_name === trace.field_name) {
                t.visible = visible
              }
            })
            saveCurrentGraphs()
            Plotly.redraw(plot)
          }
        })
        // highlight the trace by lowering the opacity of the others
        legendrow.mouseover(function () {
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
    legend.mouseout(function () {
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
      // handle plot zoom changes
      plot.on('plotly_relayout', function (data) {
        if (data['xaxis.range[0]'] && data['xaxis.range[1]']) {
          updatedata = true
          setDateRange(data['xaxis.range[0]'], data['xaxis.range[1]'])
          // update the legend values
          updateLegend(plot)
        }
      })
      // after any changes, save the current list of graphs
      saveCurrentGraphs()
    })
  }

  // check if the axis match the data range and load more data as needed
  function checkDataUpdates() {
    try {
      if (updatedata) {
        updatedata = false
        // go over all plots
        $('.myplot').each(function () {
          var plot = this
          if (plot.layout) {
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
              var url = 'data/' + plot.graph.name + '?start=' + amin.substring(0, 16) + '&end=' + dmin.substring(0, 16)
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
            // see if we need to load data past the currently loaded range
            if (amax > plot.lmax) {
              plot.lmax = amax
              // load data from dmax to amax and append
              url = 'data/' + plot.graph.name + '?start=' + dmax.substring(0, 16) + '&end=' + amax.substring(0, 16)
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
    setTimeout(checkNewData, 60000)
    $('.myplot').each(function () {
      this.lmax = undefined
    })
    updatedata = true
  }
  setTimeout(checkNewData, 60000)

  function addGraph(graph, size = 'sm') {
    var clone = $('#template>:first-child').clone()
    var plot = clone.find('.myplot')[0]
    var legend = clone.find('.mylegend')
    plot.graph = graph
    // update graph title
    clone.find('.graphtitle').text(graph.host + ' / ')
      .append($('<b>').text(graph.graph_title))
      .tooltip({title: graph.graph_info || ''})
    // tooltip for drag handle
    clone.find('.draghandle').tooltip({placement: 'right'})
    // set the size changing actions
    clone.find('.sizesm').tooltip({placement: 'right'}).click(function () {
      clone.find('.sizeactive').removeClass('sizeactive')
      $(this).addClass('sizeactive')
      $(plot).addClass('plot-sm').removeClass('plot-md plot-lg')
      legend.addClass('legend-sm').removeClass('legend-md legend-lg')
      Plotly.relayout(plot, {})
      saveCurrentGraphs()
    })
    clone.find('.sizemd').tooltip({placement: 'right'}).click(function () {
      clone.find('.sizeactive').removeClass('sizeactive')
      $(this).addClass('sizeactive')
      $(plot).addClass('plot-md').removeClass('plot-sm plot-lg')
      legend.addClass('legend-md').removeClass('legend-sm legend-lg')
      Plotly.relayout(plot, {})
      saveCurrentGraphs()
    })
    clone.find('.sizelg').tooltip({placement: 'right'}).click(function () {
      clone.find('.sizeactive').removeClass('sizeactive')
      $(this).addClass('sizeactive')
      $(plot).addClass('plot-lg').removeClass('plot-sm plot-md')
      legend.addClass('legend-lg').removeClass('legend-sm legend-md')
      Plotly.relayout(plot, {})
      saveCurrentGraphs()
    })
    // configure the close button
    clone.find('.closegraph').tooltip({placement: 'right'}).click(function () {
      $(this).tooltip('dispose')
      clone.hide(400, function () {
        Plotly.purge(plot)
        $(this).remove()
        // after any changes, save the current list of graphs
        saveCurrentGraphs()
      })
    })
    // set the wanted size
    $(plot).addClass('plot-' + size)
    legend.addClass('legend-' + size)
    clone.find('.sizeactive').removeClass('sizeactive')
    clone.find('.size' + size).addClass('sizeactive')
    // load the graph data
    loadGraph(plot, legend, graph)
    // enable tooltips on legend
    clone.find('.mylegend *[title]').tooltip({placement: 'bottom', container: 'body'})
    // show the graph
    clone.appendTo('#draggablelist')
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
    Object.keys(hosts).sort().forEach(function (group) {
      var groupElement = $('<optgroup></optgroup>').attr('label', group)
      hosts[group].sort().forEach(function (host) {
        groupElement.append($('<option></option>').attr('value', group + '/' + host).text(host))
      })
      $('#hostselect').append(groupElement)
    })
    // update options in category selector
    categories.sort().forEach(function (category) {
      $('#categoryselect').append($('<option></option>').attr('value', category).text(category))
    })
    // handler for updating the choices in the graph select
    function updateGraphList() {
      var search = $('#graphfilter').val().toLowerCase().split(' ')
      var hostFilter = $('#hostselect').val()
      var categoryFilter = $('#categoryselect').val()
      $('#graphselect').empty()
      Object.keys(graphs).sort().forEach(function (graph) {
        if (hostFilter && !graph.startsWith(hostFilter + '/')) {
          return
        }
        if (categoryFilter && graphs[graph].category !== categoryFilter) {
          return
        }
        var descripton = (graph + ' ' + graphs[graph].graph_title + ' ' + graphs[graph].category).toLowerCase()
        if (search.some(x => !descripton.includes(x))) {
          return
        }
        var title = graphs[graph].graph_title || graph.split('/')[2]
        var graphelement = $('<a href="#" class="list-group-item list-group-item-action" data-toggle="collapse" data-target="#addgraph"></a>').text(title)
        // add the host graph unless a host graph has been selected
        if (!hostFilter) {
          graphelement.prepend($('<small></small>').text(graph.split('/')[1] + ' / '))
        }
        $('#graphselect').append(graphelement)
        graphelement.click(function () {
          addGraph(graphs[graph])
        })
      })
      $('#graphfilter').focus()
    }
    $('#hostselect').change(updateGraphList)
    $('#categoryselect').change(updateGraphList)
    $('#graphfilter').on('input', updateGraphList)
    $('.addgraph button').click(function () {
      setTimeout(function () {
        $('#graphfilter').focus()
      }, 100)
    })
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

  // remove all graphs from the view
  function clearGraphs() {
    $('#draggablelist li').hide(400, function () {
      Plotly.purge($('.myplot'))
      $(this).remove()
      // after any changes, save the current list of graphs
      saveCurrentGraphs()
      $('#clearGraphs').blur()
    })
  }

  // restore the list of graphs as defined in the provided list
  function setGraphs(graphs) {
    clearGraphs()
    graphs.forEach(function (graph) {
      // lookup the graph by name
      var plot = addGraph(document.graph_data[graph.name], graph.size || 'sm')
      // hide fields
      if (graph.hidden && graph.hidden.length) {
        graph.hidden.forEach(function (field) {
          if (plot.tracebyfield[field]) {
            plot.tracebyfield[field].visible = false
            if (plot.tracebyfield[field + '.min']) {
              plot.tracebyfield[field + '.min'].visible = false
              plot.tracebyfield[field + '.min'].showlegend = false
              plot.tracebyfield[field + '.max'].visible = false
              plot.tracebyfield[field + '.max'].showlegend = false
            }
            plot.legendbyfield[field].style.opacity = 0.2
          }
        })
      }
    })
  }

  // configure the clearGraphs button
  $('#clearGraphs').click(function () {
    clearGraphs()
    $('#dashboards button.dropdown-toggle span').text('Dashboards')
  })

  // configure the dashboards button
  $.getJSON('dashboards', function (dashboards) {
    if (Object.keys(dashboards).length === 0) {
      $('#dashboards').remove()
    } else {
      Object.keys(dashboards).sort().forEach(function (name) {
        var option = $('<button class="dropdown-item" type="button">').text(name)
        $('#dashboards .dropdown-menu').append(option)
        option.click(function () {
          var dashboard = dashboards[name]
          setGraphs(dashboard.graphs)
          setDateRange(dashboard.dateRange.start, dashboard.dateRange.end)
          $('#dashboards button.dropdown-toggle span').text(name)
        })
      })
    }
  })

  // load information on available graphs
  $.getJSON('graphs', function (data) {
    document.graph_data = data
    updateSelect(data)
    // hide loading indicator and show normal interface
    $('.loadingrow').hide()
    $('.addgraph').show()
    $('nav .d-none').removeClass('d-none')
    // restore previous list of graphs
    try {
      setGraphs(JSON.parse(localStorage.getItem('shownGraphs')))
    } catch (error) {}
  })
})
