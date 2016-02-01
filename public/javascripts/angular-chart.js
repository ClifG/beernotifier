(function (factory) {
  'use strict';
  if (typeof exports === 'object') {
    // Node/CommonJS
    module.exports = factory(
      typeof angular !== 'undefined' ? angular : require('angular'),
      typeof Chart !== 'undefined' ? Chart : require('chart.js'));
  }  else if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['angular', 'chart'], factory);
  } else {
    // Browser globals
    factory(angular, Chart);
  }
}(function (angular, Chart) {
  'use strict';

  Chart.defaults.global.multiTooltipTemplate = '<%if (datasetLabel){%><%=datasetLabel%>: <%}%><%= value %>';
  Chart.defaults.global.colors = [
    '#97BBCD', // blue
    '#DCDCDC', // light grey
    '#F7464A', // red
    '#46BFBD', // green
    '#FDB45C', // yellow
    '#949FB1', // grey
    '#4D5360'  // dark grey
  ];

  var usingExcanvas = typeof window.G_vmlCanvasManager === 'object' &&
    window.G_vmlCanvasManager !== null &&
    typeof window.G_vmlCanvasManager.initElement === 'function';

  if (usingExcanvas) Chart.defaults.global.animation = false;

  return angular.module('chart.js', [])
    .provider('ChartJs', ChartJsProvider)
    .factory('ChartJsFactory', ['ChartJs', '$timeout', ChartJsFactory])
    .directive('chartBase', function (ChartJsFactory) { return new ChartJsFactory(); })
    .directive('chartLine', function (ChartJsFactory) { return new ChartJsFactory('line'); })
    .directive('chartBar', function (ChartJsFactory) { return new ChartJsFactory('bar'); })
    .directive('chartRadar', function (ChartJsFactory) { return new ChartJsFactory('radar'); })
    .directive('chartDoughnut', function (ChartJsFactory) { return new ChartJsFactory('doughnut'); })
    .directive('chartPie', function (ChartJsFactory) { return new ChartJsFactory('pie'); })
    .directive('chartPolarArea', function (ChartJsFactory) { return new ChartJsFactory('polarArea'); });

  /**
   * Wrapper for chart.js
   * Allows configuring chart js using the provider
   *
   * angular.module('myModule', ['chart.js']).config(function(ChartJsProvider) {
   *   ChartJsProvider.setOptions({ responsive: true });
   *   ChartJsProvider.setOptions('Line', { responsive: false });
   * })))
   */
  function ChartJsProvider () {
    var options = {};
    var ChartJs = {
      Chart: Chart,
      getOptions: function (type) {
        var typeOptions = type && options[type] || {};
        return angular.extend({}, options, typeOptions);
      }
    };

    /**
     * Allow to set global options during configuration
     */
    this.setOptions = function (type, customOptions) {
      // If no type was specified set option for the global object
      if (! customOptions) {
        customOptions = type;
        options = angular.extend(options, customOptions);
        return;
      }
      // Set options for the specific chart
      options[type] = angular.extend(options[type] || {}, customOptions);
    };

    this.$get = function () {
      return ChartJs;
    };
  }

  function ChartJsFactory (ChartJs, $timeout) {
    return function chart (type) {
      return {
        restrict: 'CA',
        scope: {
          getColour: '=?',
          chartType: '=',
          chartData: '=?',
          chartLabels: '=?',
          chartOptions: '=?',
          chartSeries: '=?',
          chartColors: '=?',
          chartClick: '=?',
          chartHover: '=?'
        },
        link: function (scope, elem/*, attrs */) {
          var chart;

          if (usingExcanvas) window.G_vmlCanvasManager.initElement(elem[0]);

          // Order of setting "watch" matter

          scope.$watch('chartData', function (newVal, oldVal) {
            if (! newVal || ! newVal.length || (Array.isArray(newVal[0]) && ! newVal[0].length)) return;
            var chartType = type || scope.chartType;
            if (! chartType) return;

            if (chart) {
              if (canUpdateChart(newVal, oldVal)) return updateChart(chart, newVal, scope);
              chart.destroy();
            }

            createChart(chartType);
          }, true);

          scope.$watch('chartSeries', resetChart, true);
          scope.$watch('chartLabels', resetChart, true);
          scope.$watch('chartOptions', resetChart, true);
          scope.$watch('chartColors', resetChart, true);

          scope.$watch('chartType', function (newVal, oldVal) {
            if (isEmpty(newVal)) return;
            if (angular.equals(newVal, oldVal)) return;
            if (chart) chart.destroy();
            createChart(newVal);
          });

          scope.$on('$destroy', function () {
            if (chart) chart.destroy();
          });

          function resetChart (newVal, oldVal) {
            if (isEmpty(newVal)) return;
            if (angular.equals(newVal, oldVal)) return;
            var chartType = type || scope.chartType;
            if (! chartType) return;

            // chart.update() doesn't work for series and labels
            // so we have to re-create the chart entirely
            if (chart) chart.destroy();

            createChart(chartType);
          }

          function createChart (type) {
            // TODO: check parent?
            if (isResponsive(type, scope) && elem[0].clientHeight === 0) {
              return $timeout(function () {
                createChart(type);
              }, 50, false);
            }
            if (! scope.chartData || ! scope.chartData.length) return;
            scope.getColour = typeof scope.getColour === 'function' ? scope.getColour : getRandomColour;
            scope.chartColors = getColors(type, scope);
            var cvs = elem[0], ctx = cvs.getContext('2d');
            var data = Array.isArray(scope.chartData[0]) ?
              getDataSets(scope.chartLabels, scope.chartData, scope.chartSeries || [], scope.chartColors) :
              getData(scope.chartLabels, scope.chartData, scope.chartColors);

            var options = angular.extend({}, ChartJs.getOptions(type), scope.chartOptions);
            chart = new ChartJs.Chart(ctx, {
              type: type,
              data: data,
              options: options
            });
            scope.$emit('chart-create', chart);

            // Bind events
            cvs.onclick = scope.chartClick ? getEventHandler(scope, chart, 'chartClick', false) : angular.noop;
            cvs.onmousemove = scope.chartHover ? getEventHandler(scope, chart, 'chartHover', true) : angular.noop;
          }
        }
      };
    };

    function canUpdateChart (newVal, oldVal) {
      if (newVal && oldVal && newVal.length && oldVal.length) {
        return Array.isArray(newVal[0]) ?
        newVal.length === oldVal.length && newVal.every(function (element, index) {
          return element.length === oldVal[index].length; }) :
          oldVal.reduce(sum, 0) > 0 ? newVal.length === oldVal.length : false;
      }
      return false;
    }

    function sum (carry, val) {
      return carry + val;
    }

    function getEventHandler (scope, chart, action, triggerOnlyOnChange) {
      var lastState = null;
      return function (evt) {
        var atEvent = chart.getElementsAtEvent || chart.getPointsAtEvent;
        if (atEvent) {
          var activePoints = atEvent.call(chart, evt);
          if (triggerOnlyOnChange === false || angular.equals(lastState, activePoints) === false) {
            lastState = activePoints;
            scope[action](activePoints, evt);
            scope.$apply();
          }
        }
      };
    }

    function getColors (type, scope) {
      var colors = angular.copy(scope.chartColors ||
        ChartJs.getOptions(type).chartColors ||
        Chart.defaults.global.colors
      );
      while (colors.length < scope.chartData.length) {
        colors.push(scope.getColour());
      }
      return colors.map(convertColour);
    }

    function convertColour (colour) {
      if (typeof colour === 'object' && colour !== null) return colour;
      if (typeof colour === 'string' && colour[0] === '#') return getColour(hexToRgb(colour.substr(1)));
      return getRandomColour();
    }

    function getRandomColour () {
      var colour = [getRandomInt(0, 255), getRandomInt(0, 255), getRandomInt(0, 255)];
      return getColour(colour);
    }

    function getColour (colour) {
      return {
        backgroundColor: rgba(colour, 0.2),
        borderColor: rgba(colour, 1),
        pointBackgroundColor: rgba(colour, 1),
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: rgba(colour, 0.8)
      };
    }

    function getRandomInt (min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function rgba (colour, alpha) {
      if (usingExcanvas) {
        // rgba not supported by IE8
        return 'rgb(' + colour.join(',') + ')';
      } else {
        return 'rgba(' + colour.concat(alpha).join(',') + ')';
      }
    }

    // Credit: http://stackoverflow.com/a/11508164/1190235
    function hexToRgb (hex) {
      var bigint = parseInt(hex, 16),
        r = (bigint >> 16) & 255,
        g = (bigint >> 8) & 255,
        b = bigint & 255;

      return [r, g, b];
    }

    function getDataSets (labels, data, series, colors) {
      return {
        labels: labels,
        datasets: data.map(function (item, i) {
          return angular.extend({}, colors[i], {
            label: series[i],
            data: item,
            fill: true
          });
        })
      };
    }

    function getData (labels, data, colors) {
      return {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors.map(function (colour) {
            return colour.pointBackgroundColor;
          }),
          hoverBackgroundColor: colors.map(function (colour) {
            return colour.backgroundColor;
          })
        }]
      };
    }

    function updateChart (chart, values, scope) {
      if (Array.isArray(scope.chartData[0])) {
        chart.data.datasets.forEach(function (dataset, i) {
          dataset.data = values[i];
        });
      } else {
        chart.data.datasets[0].data = values;
      }

      chart.update();
      scope.$emit('chart-update', chart);
    }

    function isEmpty (value) {
      return ! value ||
        (Array.isArray(value) && ! value.length) ||
        (typeof value === 'object' && ! Object.keys(value).length);
    }

    function isResponsive (type, scope) {
      var options = angular.extend({}, Chart.defaults.global, ChartJs.getOptions(type), scope.chartOptions);
      return options.responsive;
    }
  }
}));