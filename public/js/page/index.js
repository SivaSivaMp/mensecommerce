if (typeof jQuery === 'undefined') {
    throw new Error('jQuery plugins need to be before this file');
}

$(function () {
    'use strict';

    let salesChart;
    let donutChart;

    // INIT SALES LINE CHART

    function initSalesChart() {
        const options = {
            series: [
                { name: 'Sales', data: [], yAxisIndex: 0 },
                { name: 'Order Items', data: [], yAxisIndex: 1 },
            ],

            chart: {
                height: 270,
                type: 'line',
                toolbar: { show: false },
            },

            stroke: { width: 2, curve: 'smooth' },

            xaxis: {
                categories: [],
                labels: { rotate: -45, style: { fontSize: '12px' } },
            },

            yaxis: [
                {
                    title: { text: 'Sales' },
                    labels: { formatter: (v) => v.toLocaleString() },
                },
                {
                    opposite: true,
                    title: { text: 'Order Items' },
                    min: 0,
                    max: 10, // adjust to your data
                    tickAmount: 5,
                },
            ],

            legend: { position: 'top', horizontalAlign: 'right' },
        };

        salesChart = new ApexCharts(
            document.querySelector('#apex-shoppingstatus'),
            options
        );
        salesChart.render();
    }

    // INIT DONUT CHART

    function initDonutChart() {
        const options = {
            chart: {
                type: 'donut',
                height: 250,
            },
            labels: [],
            series: [],
            colors: [
                'var(--chart-color1)',
                'var(--chart-color2)',
                'var(--chart-color3)',
                'var(--chart-color4)',
                'var(--chart-color5)',
                'var(--chart-color6)',
            ],
            legend: {
                position: 'top',
                horizontalAlign: 'center',
            },
            dataLabels: {
                enabled: true,
                formatter: (val) => `${val.toFixed(1)}%`,
            },
        };

        donutChart = new ApexCharts(
            document.querySelector('#apex-simple-donut'),
            options
        );

        donutChart.render();
    }

    // UPDATE DONUT CHART

    function updateDonutChart(statusCounts) {
        if (!donutChart) return;

        const labels = Object.keys(statusCounts);
        const values = Object.values(statusCounts);

        donutChart.updateOptions({
            labels: labels,
        });

        donutChart.updateSeries(values);
    }

    // LOAD CHART DATA (Called from dashboard.ejs)

    function loadCharts(startDate, endDate) {
        $.ajax({
            url: `/admin/dashboard-charts?startDate=${startDate}&endDate=${endDate}`,
            method: 'GET',

            success: function (data) {
                updateSalesChart(data.dates, data.sales, data.orderItems);

                if (
                    !data.statusCounts ||
                    Object.keys(data.statusCounts).length === 0
                ) {
                    updateDonutChart({ 'No Data': 1 });
                } else {
                    updateDonutChart(data.statusCounts);
                }
            },

            error: function () {
                console.error('Failed to load chart data');
            },
        });
    }

    // MAKE AVAILABLE TO dashboard.ejs

    window.initSalesChart = initSalesChart;
    window.initDonutChart = initDonutChart;
    window.loadCharts = loadCharts;
});
