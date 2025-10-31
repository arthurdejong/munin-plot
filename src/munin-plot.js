/*!
  Copyright (C) 2018-2025 Arthur de Jong

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
const pako = require('pako')

$(document).ready(function () {
  // make list of graphs draggable
  $('#draggablelist').sortable({
    handle: '.draghandle',
    update: function (event, ui) {
      // after any changes, save the current list of graphs
      saveCurrentGraphs()
    }
  })

  moment.fn.round10Minutes = function (how) {
    how = how || 'round'
    return this.minutes(Math[how](this.minutes() / 10) * 10).seconds(0).seconds(0).milliseconds(0)
  }

  // Save date range in local storage
  function saveDateRange(start, end) {
    localStorage.setItem('dateRange', JSON.stringify({start, end}))
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
    const daterangepicker = $('#reportrange').data('daterangepicker')
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
    saveDateRange(start, end)
  }

  function getDateRange() {
    const daterangepicker = $('#reportrange').data('daterangepicker')
    const start = daterangepicker.startDate.format('YYYY-MM-DD HH:mm')
    const end = daterangepicker.endDate.format('YYYY-MM-DD HH:mm')
    return {start, end}
  }

  // initialise the date range picker
  $('#reportrange').daterangepicker({
    locale: {
      format: 'YYYY-MM-DD HH:mm',
      firstDay: 1
    },
    opens: 'left',
    showISOWeekNumbers: true,
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

  // update the ranges when the date range picker is opened
  $('#reportrange').on('show.daterangepicker', function (ev, picker) {
    picker.ranges = {
      Today: [moment().subtract(1, 'days').round10Minutes(), moment().add(1, 'hour').round10Minutes('ceil')],
      'This week': [moment().subtract(6, 'days').startOf('day'), moment().endOf('day').round10Minutes('ceil')],
      'This month': [moment().subtract(32, 'days').startOf('day'), moment().endOf('day').round10Minutes('ceil')],
      'This year': [moment().subtract(365, 'days').startOf('month'), moment().endOf('month').round10Minutes('ceil')]
    }
  })

  const defaultColors = [
    '#00cc00', '#0066b3', '#ff8000', '#dbc300', '#330099', '#990099',
    '#bce617', '#ff0000', '#808080', '#008f00', '#00487d', '#b35a00',
    '#b38f00', '#6b006b', '#8fb300', '#b30000', '#bebebe', '#80ff80',
    '#80c9ff', '#ffc080', '#ffe680', '#aa80ff', '#ee00cc', '#ff8080',
    '#666600', '#ffbfff', '#00ffcc', '#cc6699', '#999900']

  function getColor(value) {
    if (value.startsWith('COLOUR')) {
      return defaultColors[parseInt(value.substring(6)) % defaultColors.length]
    }
    return '#' + value
  }

  const baseLayout = {
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
      title: {
        font: {
          size: 10,
          color: '#7f7f7f'
        }
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

  const config = {
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
  let updatedata = false

  // update the legend
  function updateLegend(plot) {
    const [minx, maxx] = plot.layout.xaxis.range
    Object.keys(plot.legendbyfield).forEach(function (field) {
      // calculate minimum
      const mintrace = plot.tracebyfield[field + '.min']
      const minvalue = Math.min.apply(null, mintrace.y.filter(function (y, idx) {
        const x = mintrace.x[idx]
        return x >= minx && x <= maxx && y !== null
      }))
      // calculate average
      const avgtrace = plot.tracebyfield[field]
      let avgvalue
      if (avgtrace.y.length) {
        avgvalue = avgtrace.y.map(function (current, idx) {
          const x = avgtrace.x[idx]
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
      const maxtrace = plot.tracebyfield[field + '.max']
      const maxvalue = Math.max.apply(null, maxtrace.y.filter(function (y, idx) {
        const x = maxtrace.x[idx]
        return x >= minx && x <= maxx && y !== null
      }))
      // update legend
      const columns = $(plot.legendbyfield[field]).find('td')
      columns[2].textContent = (isNaN(minvalue) || !isFinite(minvalue)) ? '-' : d3.format('.4s')(minvalue)
      columns[3].textContent = (isNaN(avgvalue) || !isFinite(avgvalue)) ? '-' : d3.format('.4s')(avgvalue)
      columns[4].textContent = (isNaN(maxvalue) || !isFinite(maxvalue)) ? '-' : d3.format('.4s')(maxvalue)
    })
  }

  // load graph data into the plot
  function loadGraph(plot, traces, layout) {
    // range of the x axis
    let url = 'data/' + plot.graph.name
    if (plot.layout) {
      const [amin, amax] = plot.layout.xaxis.range
      url += '?start=' + amin.substring(0, 16).replace(' ', 'T') + '&end=' + amax.substring(0, 16).replace(' ', 'T')
    }
    d3.csv(url).then(function (data) {
      // clear traces
      Object.keys(plot.tracebyfield).forEach(function (field) {
        plot.tracebyfield[field].x = []
        plot.tracebyfield[field].y = []
      })
      // load new data
      data.forEach(function (row) {
        Object.keys(plot.tracebyfield).forEach(function (field) {
          const value = row[field] ? Number(row[field]) : null
          if (row[field] || plot.tracebyfield[field].y.length > 0) {
            plot.tracebyfield[field].x.push(row.time)
            plot.tracebyfield[field].y.push(value)
          }
        })
      })
      // remove trailing nulls from traces
      Object.keys(plot.tracebyfield).forEach(function (field) {
        while (plot.tracebyfield[field].y[plot.tracebyfield[field].y.length - 1] === null) {
          plot.tracebyfield[field].x.pop()
          plot.tracebyfield[field].y.pop()
        }
      })
      if (traces) {
        // initial plot creation
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
      } else {
        plot.layout.datarevision += 1
        Plotly.react(plot, plot.data, plot.layout)
      }
    })
  }

  // check if we have been flagged to update the data series for the plots
  function checkDataUpdates() {
    try {
      if (updatedata) {
        updatedata = false
        // go over all plots
        $('.myplot').each(function (index, plot) {
          if (plot.layout) {
            loadGraph(plot)
          }
        })
      }
    } finally {
      setTimeout(checkDataUpdates, 1000)
    }
  }
  setTimeout(checkDataUpdates, 1000)

  // every minute check if we should load new data
  function checkNewData() {
    setTimeout(checkNewData, 60000)
    $('.myplot').each(function (index, plot) {
      // if any plot has incomplete data, reload the data
      if (plot.layout) {
        if (moment().format('YYYY-MM-DD HH:mm') < plot.layout.xaxis.range[1]) { updatedata = true }
      }
    })
  }
  setTimeout(checkNewData, 60000)

  // add a graph to the list of graphs
  function addGraph(graph, size = 'sm') {
    const clone = $('#template>:first-child').clone()
    const plot = clone.find('.myplot')[0]
    const legend = clone.find('.mylegend')
    plot.graph = graph
    // update graph title
    clone.find('.graphtitle').text(graph.host + ' / ')
      .append($('<b>').text(graph.graph_title))
      .attr('title', graph.graph_info || '')
    // set the size changing actions
    clone.find('.sizesm').click(function () {
      clone.find('.sizeactive').removeClass('sizeactive')
      $(this).addClass('sizeactive')
      $(plot).addClass('plot-sm').removeClass('plot-md plot-lg')
      legend.addClass('legend-sm').removeClass('legend-md legend-lg')
      Plotly.relayout(plot, {})
      saveCurrentGraphs()
    })
    clone.find('.sizemd').click(function () {
      clone.find('.sizeactive').removeClass('sizeactive')
      $(this).addClass('sizeactive')
      $(plot).addClass('plot-md').removeClass('plot-sm plot-lg')
      legend.addClass('legend-md').removeClass('legend-sm legend-lg')
      Plotly.relayout(plot, {})
      saveCurrentGraphs()
    })
    clone.find('.sizelg').click(function () {
      clone.find('.sizeactive').removeClass('sizeactive')
      $(this).addClass('sizeactive')
      $(plot).addClass('plot-lg').removeClass('plot-sm plot-md')
      legend.addClass('legend-lg').removeClass('legend-sm legend-md')
      Plotly.relayout(plot, {})
      saveCurrentGraphs()
    })
    // configure the close button
    clone.find('.closegraph').click(function () {
      clone.hide(400, function () {
        Plotly.purge(plot)
        $(this).remove()
        // after any changes, save the current list of graphs
        saveCurrentGraphs()
      })
    })
    // set the selection changing actions
    clone.find('.selectall').click(function () {
      if (plot.data) {
        traces.slice().reverse().forEach(function (trace) {
          if (trace.showlegend !== false) {
            plot.legendbyfield[trace.field_name].style.opacity = 1
            plot.data.forEach(function (t) {
              if (t.field_name === trace.field_name) {
                t.visible = true
              }
            })
          }
        })
        saveCurrentGraphs()
        Plotly.react(plot, plot.data, plot.layout, plot.config)
      }
    })
    clone.find('.selecttoggle').click(function () {
      if (plot.data) {
        traces.slice().reverse().forEach(function (trace) {
          if (trace.showlegend !== false) {
            const visible = (trace.visible === false)
            plot.legendbyfield[trace.field_name].style.opacity = visible ? 1 : 0.2
            plot.data.forEach(function (t) {
              if (t.field_name === trace.field_name) {
                t.visible = visible
              }
            })
          }
        })
        saveCurrentGraphs()
        Plotly.react(plot, plot.data, plot.layout, plot.config)
      }
    })
    clone.find('.selectnone').click(function () {
      if (plot.data) {
        traces.slice().reverse().forEach(function (trace) {
          if (trace.showlegend !== false) {
            plot.legendbyfield[trace.field_name].style.opacity = 0.2
            plot.data.forEach(function (t) {
              if (t.field_name === trace.field_name) {
                t.visible = false
              }
            })
          }
        })
        saveCurrentGraphs()
        Plotly.react(plot, plot.data, plot.layout, plot.config)
      }
    })
    // set the wanted size
    $(plot).addClass('plot-' + size)
    legend.addClass('legend-' + size)
    clone.find('.sizeactive').removeClass('sizeactive')
    clone.find('.size' + size).addClass('sizeactive')
    // prepare the graph configuration
    const layout = JSON.parse(JSON.stringify(baseLayout))
    if (plot.graph.graph_vlabel) {
      layout.yaxis.title.text = plot.graph.graph_vlabel
    }
    if (plot.graph.graph_args && plot.graph.graph_args.match(/--logarithmic/)) {
      layout.yaxis.type = 'log'
      layout.yaxis.exponentformat = 'E'
    }
    // get x axis zoom from date range selector
    const range = getDateRange()
    layout.xaxis.range = [range.start, range.end]
    // prepare the data series configuration
    const traces = []
    const tracebyfield = {}
    plot.tracebyfield = tracebyfield
    let stackgroup = 0
    for (let i = 0; i < plot.graph.fields.length; i++) {
      const field = plot.graph.fields[i]
      const color = field.colour ? getColor(field.colour) : defaultColors[i % defaultColors.length]
      if (field.draw === 'AREA' || field.draw === 'STACK' || field.draw === 'AREASTACK') {
        if (!field.draw.match(/STACK/) && (!plot.graph.fields[i + 1] || plot.graph.fields[i + 1].draw.match(/STACK/))) {
          stackgroup += 1
        }
        const trace = {
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
        const trace = {
          field_name: field.name,
          name: field.label || field.name,
          info: field.info || '',
          line: {color},
          hoverlabel: {bgcolor: color + 'c0'}
        }
        const minTrace = {
          field_name: field.name,
          showlegend: false,
          hoverinfo: 'skip',
          line: {width: 0},
          connectgaps: true
        }
        const maxTrace = {
          field_name: field.name,
          showlegend: false,
          hoverinfo: 'skip',
          line: {width: 0},
          connectgaps: true,
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
    traces.slice().forEach(function (trace) {
      if (trace.showlegend !== false) {
        const legendrow = $('<tr></tr>')
        legendrow.append($('<td style="width: 20px;"><svg height="10" width="10"><line x1="0" y1="5" x2="10" y2="5"></svg></td>'))
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
        // handle showing/hiding the trace by clicking in the legend
        legendrow.click(function () {
          if (plot.data) {
            const visible = (trace.visible === false)
            $(this).css('opacity', visible ? 1 : 0.2)
            plot.data.forEach(function (t) {
              if (t.field_name === trace.field_name) {
                t.visible = visible
              }
            })
            saveCurrentGraphs()
            Plotly.react(plot, plot.data, plot.layout, plot.config)
          }
        })
        // hide all other traces on double click in the legend
        legendrow.on('dblclick', function () {
          if (plot.data) {
            const selected = trace
            traces.slice().forEach(function (trace) {
              if (trace.showlegend !== false) {
                const visible = (trace.field_name === selected.field_name)
                plot.legendbyfield[trace.field_name].style.opacity = visible ? 1 : 0.2
                plot.data.forEach(function (t) {
                  if (t.field_name === trace.field_name) {
                    t.visible = visible
                  }
                })
              }
            })
            saveCurrentGraphs()
            Plotly.react(plot, plot.data, plot.layout, plot.config)
          }
        })
        // highlight the trace by lowering the opacity of the others traces
        legendrow.mouseover(function () {
          if (plot.data) {
            Plotly.restyle(plot, 'opacity', plot.data.map(
              t => t.field_name === trace.field_name ? 1 : 0.1))
            Plotly.restyle(plot, 'fillcolor', plot.data.map(function (t) {
              if (t.showlegend === false) {
                return (t.fillcolor || '#ffffff').substring(0, 7) + (t.field_name === trace.field_name ? '25' : '05')
              }
              return (t.fillcolor || '#ffffff').substring(0, 7) + (t.field_name === trace.field_name ? 'ff' : '30')
            }))
          }
        })
      }
    })
    // restore opacity after exiting the legend
    legend.mouseout(function () {
      if (plot.data) {
        Plotly.restyle(plot, 'opacity', plot.data.map(t => 1))
        Plotly.restyle(plot, 'fillcolor', plot.data.map(function (t) {
          if (t.showlegend === false) {
            return (t.fillcolor || '#ffffff').substring(0, 7) + '20'
          }
          return (t.fillcolor || '#ffffff').substring(0, 7) + 'c0'
        }))
      }
    })
    // fetch the data and plot it
    loadGraph(plot, traces, layout)
    // show the graph
    clone.appendTo('#draggablelist')
    return plot
  }

  // update the select widget to be able to list the known graphs
  function updateSelect(graphs) {
    // make lists of groups, hosts and categories
    const hosts = {}
    const categories = []
    for (const graph in graphs) {
      const parts = graph.split('/')
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
      const groupElement = $('<optgroup></optgroup>').attr('label', group)
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
      const search = $('#graphfilter').val().toLowerCase().split(' ')
      const hostFilter = $('#hostselect').val()
      const categoryFilter = $('#categoryselect').val()
      $('#graphselect').empty()
      Object.keys(graphs).sort().forEach(function (graph) {
        if (hostFilter && !graph.startsWith(hostFilter + '/')) {
          return
        }
        if (categoryFilter && graphs[graph].category !== categoryFilter) {
          return
        }
        const description = (graph + ' ' + graphs[graph].graph_title + ' ' + graphs[graph].category).toLowerCase()
        if (search.some(x => !description.includes(x))) {
          return
        }
        const title = graphs[graph].graph_title || graph.split('/')[2]
        const graphelement = $('<a href="#" class="list-group-item list-group-item-action" data-bs-toggle="collapse" data-bs-target="#addgraph"></a>').text(title)
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
        const result = {
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
        if (!result.hidden.length) {
          delete result.hidden
        }
        return result
      }
      return undefined
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
      const plot = addGraph(document.graph_data[graph.name], graph.size || 'sm')
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

  // JSON serialise the data, compress and BASE64 encode
  function compressData(data) {
    return btoa(Array.from(pako.deflate(JSON.stringify(data))).map(b => String.fromCharCode(b)).join(''))
  }

  // BASE64 decode, decompress and JSON deserialise the data
  function decompressData(text) {
    return JSON.parse(pako.inflate(atob(text).split('').map(x => x.charCodeAt(0)), {to: 'string'}))
  }

  // make the provided dashboard active
  function setDashboard(dashboard) {
    if (dashboard.dateRange) {
      setDateRange(dashboard.dateRange.start, dashboard.dateRange.end)
    }
    setGraphs(dashboard.graphs)
    if (dashboard.name) {
      $('#dashboards button.dropdown-toggle span').text(dashboard.name)
    }
  }

  // output readable but compact JSON
  function getCurrentDashboard() {
    let value = '{\n'
    const name = $('#saveDashboardName').val()
    if (name) {
      value += '  "name": ' + JSON.stringify(name) + ',\n'
    }
    if ($('#saveDashboardDateRange:checked').length) {
      const range = getDateRange()
      value += '  "dateRange": ' + JSON.stringify({start: range.start, end: range.end}) + ',\n'
    }
    value += '  "graphs": ' + JSON.stringify(getCurrentGraphs()) + '\n}'
    return value
  }

  // get dashboard data from URL
  function loadDashboardFromHash() {
    if (window.location.hash.length > 2) {
      // get list of graphs from URL
      setDashboard(decompressData(window.location.hash.slice(1)))
      // remove the hash from the URL
      history.replaceState(null, '', ' ')
    }
  }

  // configure the dashboards button
  $.getJSON('dashboards', function (dashboards) {
    if (Object.keys(dashboards).length === 0) {
      $('#dashboards').remove()
    } else {
      Object.keys(dashboards).sort().forEach(function (name) {
        const option = $('<button class="dropdown-item" type="button">').text(name)
        $('#dashboards .dropdown-menu').append(option)
        option.click(function () {
          setDashboard(dashboards[name])
        })
      })
      // add import action
      $('#dashboards .dropdown-menu').append('<div class="dropdown-divider"></div>')
      $('#loadDashboardBtn').removeClass('btn btn-outline-secondary').addClass('dropdown-item')
      $('#dashboards .dropdown-menu').append($('#loadDashboardBtn').append(' Load'))
    }
  })

  // handle showing and hiding of the save dashboard dialog
  document.getElementById('saveDashboard').addEventListener('shown.bs.modal', function () {
    $('#saveDashboardName').trigger('focus')
  })
  document.getElementById('saveDashboard').addEventListener('hidden.bs.modal', function () {
    $('#saveDashboardName').val('')
    $('#saveDashboard .alert').remove()
  })

  // save dashboard data URL to clipboard
  $('#saveDashboardUrl').on('click', function (event) {
    // create a temporary text area
    const textarea = document.createElement('textarea')
    $(textarea).css({
      position: 'absolute',
      left: '-1000px',
      top: '-1000px'
    })
    // fill text area with URL
    textarea.value = window.location.href.split('#')[0] + '#' + compressData(JSON.parse(getCurrentDashboard()))
    // copy text area to clipboard
    $('#saveDashboard form').append(textarea)
    textarea.select()
    textarea.setSelectionRange(0, 99999)
    document.execCommand('copy')
    $('#saveDashboard form textarea').remove()
    // show notification
    $('<div class="alert alert-success">Copied to clipboard</div>').hide().appendTo('#saveDashboard .modal-body').show(200, function () {
      setTimeout(function () {
        bootstrap.Modal.getInstance(document.getElementById('saveDashboard')).hide()
      }, 600)
    })
  })

  // save dialog copy data to clipboard
  $('#saveDashboardClipboard').on('click', function (event) {
    // create a temporary text area
    const textarea = document.createElement('textarea')
    $(textarea).css({
      position: 'absolute',
      left: '-1000px',
      top: '-1000px'
    })
    // fill text area with JSON
    textarea.value = getCurrentDashboard()
    // copy text area to clipboard
    $('#saveDashboard form').append(textarea)
    textarea.select()
    textarea.setSelectionRange(0, 99999)
    document.execCommand('copy')
    $('#saveDashboard form textarea').remove()
    // show notification
    $('<div class="alert alert-success">Copied to clipboard</div>').hide().appendTo('#saveDashboard .modal-body').show(200, function () {
      setTimeout(function () {
        bootstrap.Modal.getInstance(document.getElementById('saveDashboard')).hide()
      }, 600)
    })
  })

  // save dashboard definition to file
  $('#saveDashboardFile').on('click', function (event) {
    const element = document.createElement('a')
    element.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(getCurrentDashboard() + '\n'))
    element.setAttribute('download', 'dashboard.json')
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    bootstrap.Modal.getInstance(document.getElementById('saveDashboard')).hide()
  })

  // handle showing and hiding of the load dashboard dialog
  document.getElementById('loadDashboard').addEventListener('shown.bs.modal', function () {
    $('#loadDashboardData').trigger('focus')
  })
  document.getElementById('loadDashboard').addEventListener('hidden.bs.modal', function () {
    $('#loadDashboardData').val('')
    $('#loadDashboard .alert').remove()
  })

  // load dashboard definition from file into text area
  $('#loadDashboardFileBtn').on('click', function (event) {
    $('#loadDashboardFile').click()
  })
  $('#loadDashboardFile').on('change', function (event) {
    const reader = new FileReader()
    reader.onload = function (e) {
      $('#loadDashboardData').val(e.target.result)
    }
    reader.readAsText(this.files[0], 'utf-8')
    $(this).val('')
  })

  // load dashboard
  $('#loadDashboardGo').on('click', function (event) {
    try {
      const dashboard = JSON.parse($('#loadDashboardData').val())
      if (dashboard) {
        setDashboard(dashboard)
        bootstrap.Modal.getInstance(document.getElementById('loadDashboard')).hide()
      }
    } catch (e) {
      $('#loadDashboard .alert').remove()
      $('<div class="alert alert-danger"></div>').text('Error: ' + e.name + ': ' + e.message).hide().appendTo('#loadDashboard .modal-body').show(200)
    }
  })

  try {
    // restore the previously saved date range
    const data = JSON.parse(localStorage.getItem('dateRange'))
    setDateRange(data.start, data.end)
  } catch (error) {
    // set a default date range
    setDateRange(moment().subtract(2, 'days'), moment().add(1, 'hour').round10Minutes('ceil'))
  }

  // load information on available graphs
  $.getJSON('graphs', function (data) {
    document.graph_data = data
    updateSelect(data)
    // hide loading indicator and show normal interface
    $('.loadingrow').hide()
    $('.addgraph').show()
    $('nav .d-none').removeClass('d-none')
    if (window.location.hash.length > 2) {
      loadDashboardFromHash()
    } else {
      // restore previous list of graphs
      try {
        setGraphs(JSON.parse(localStorage.getItem('shownGraphs')))
      } catch (error) {
        // ignore errors
      }
    }
  })

  // handle changes to hash
  window.addEventListener('hashchange', function () {
    loadDashboardFromHash()
  })

  function resizeForPrinting() {
    $('.myplot').each(function () {
      if (this.layout) {
        const box = this.getBoundingClientRect()
        Plotly.relayout(this, {width: box.width, height: box.height})
      }
    })
  }

  function restoreFromPrinting() {
    $('.myplot').each(function () {
      if (this.layout) {
        Plotly.relayout(this, {width: null, height: null, autosize: true})
      }
    })
  }

  window.addEventListener('beforeprint', resizeForPrinting)
  window.addEventListener('afterprint', restoreFromPrinting)
  window.matchMedia('print').addListener(function (mql) {
    if (mql.matches) {
      resizeForPrinting()
    } else {
      restoreFromPrinting()
    }
  })
})
