<template>
  <div class="card">
    <v-expansion-panels v-model="panel">
      <v-expansion-panel>
        <v-expansion-panel-header>
          <div class="handle" style="font-size: 20px">
            <v-icon style="margin-right: 10px" @click="onClose">close</v-icon>
            <span>Scatter Plot </span>
          </div>
        </v-expansion-panel-header>
      </v-expansion-panel>
    </v-expansion-panels>
    <div>
      <multiselect
        class="select_feature"
        v-model="value"
        :options="numericFeatures"
        single
      ></multiselect>
    </div>

    <div>
      <multiselect
        class="select_feature_y"
        v-model="value_y"
        :options="numericFeatures"
        single
      ></multiselect>
    </div>

    <!-- <div>
        <multiselect class='select_classifier' 
        v-model="classifierValue" :options="classifiers" single></multiselect>
    </div> -->

    <div ref="svg" />
  </div>
</template>

<script src="https://cdnjs.cloudflare.com/ajax/libs/chroma-js/1.3.5/chroma.min.js"></script>

<script lang="ts">
import Vue from 'vue';
import * as d3 from 'd3';
import {
  BoxProps,
  Instance,
  SelectionRecord,
  Metrics,
} from '../../types';
import {
  instanceById,
  intersection,
} from '../../utils';
import { PredicateSimple, Rule } from '../constraints/types';
import { blankConstraint } from '../constraints/utils';
import { colors } from '../../theme';
interface MetricsWithClassifier {
  classifier: string;
  metrics: Metrics;
}
export default Vue.extend({
  name: 'ScatterPlot',
  props: {
    boxProps: {
      type: Object as () => BoxProps,
      required: true,
    },
    onClose: {
      type: Function,
      required: true,
    },
  },
  data() {
    const margin = {top: 30, right: 20, bottom: 90, left: 120};
    const width = 1000 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;
    const accuracySorting = 'descending' as 'ascending' | 'descending' | '' | 'alphabetical';
    const hover = {
      type: '' as 'right' | 'wrong' | '',
      classifier: '',
    };
    const chosenData = "All" as "All" | "selection1" | "selection2"
    const evaluationSelection = 'acc2' as 'acc1'| 'acc2' | 'acc3' | 'uncertain';
    const zoom = {
      type: '' as 'in' | 'out' | '',
      obejct: '',
    };
    const value_y = 'prediction-' + [...this.boxProps.classifiers][3]
    return {
      svg: '',
      zoom,
      min:0,
      max:100,
      max_value: 0,
      evaluationSelection,
      value: '',
      value_y,
      classifierValue: '',
      chosenData,
      accuracySorting,
      height,
      correlation_mode:'No',
      hover,
      margin,
      curclick:[],
      panel: [],
      rightColor: '#d1e5f0',
      rightHoverColor: '#4393c3',
      selection1Color: '#18FFFF',
      selection2Color: '#FF4081',
      width,
      selectedEval:'',
      wrongColor: '#fddbc7',
      wrongHoverColor: '#d6604d',
      correlations:[],
      featureIntervals: Number,
      featureYIntervals: Number,
      preCorrelations: [],
      prefeatureIntervals: Number,
      prefeatureYIntervals: Number,
      premax_value: 0,
      clickCount: 0,
      clickTimer: 0,
    };
  },
  computed: {
    correlationMode() : String {
      var correlationMode = ""
      switch (this.evaluationSelection) {
        case 'acc1' :
          correlationMode = "acc1"
          break;
        case 'acc2' :
          correlationMode = "acc2"
          break; 
        case 'acc3' :
          correlationMode = "acc3"
          break; 
        case 'uncertain' :
          correlationMode = "uncertain"
          break;  
      }
      return correlationMode;
    },
    selectionHistory(): SelectionRecord[] {
      return this.$store.state.selectionHistory;
    },
    numericFeatures(): any[] {
        const allFeatures = [...this.boxProps.features];
        const numericTypes = ['interval', 'ratio'];
        const isNumeric = (featureName: string) => {
            const feature = this.$store.getters.feature(featureName);
            return numericTypes.includes(feature.type);
        };
        const numericFeatures =  allFeatures.filter(isNumeric);
        this.classifiers.forEach((c)=>{
          numericFeatures.push('prediction-'+c)
        })
        
        return numericFeatures;
    },
    classes(): string[] {
      return [...this.boxProps.classes];
    },
    classifiers(): string[] {
      const allClassifiers = [...this.boxProps.classifiers];
      const dummyClassifiers = [
        'Oracle',
        'Majority Classifier',
        'Random Classifier',
      ];
      return allClassifiers.filter((c) => !dummyClassifiers.includes(c));
    },
    uncertaintyRange(): string[] {
      return ["0.00","0.01","0.02","0.03","0.04","0.05","0.06","0.07","0.08","0.09","0.10"]
    },
    classifierThresholds():{} {
      return this.$store.state.classifierThreshods;
    },
    externalHoverInstance(): string {
      return this.$store.state.hoverInstance;
    },
    instances(): string[] {
      return [...this.boxProps.instances];
    },
    features() :any[] {
      const allFeatures = [...this.boxProps.features];
      const numericTypes = ['interval', 'ratio'];
      const isNumeric = (featureName: string) => {
        const feature = this.$store.getters.feature(featureName);
        return numericTypes.includes(feature.type);
      };
      const numericFeatures =  allFeatures.filter(isNumeric);
      const categoricalFeatures = [...this.boxProps.features].filter((f) => this.$store.getters.feature(f).type === 'categorical');
      let features = []//this.$store.getters.featuresDict.columns.filter((c)=>c != "id" && c != "");
      numericFeatures.forEach((c)=>{
        features.push(c)
      })
      categoricalFeatures.forEach((c)=>{
        features.push(c)
      })
      features = features.filter(f=>f!="train_or_test")
      return features;
    },
    InitialCorrelations(): any[] {
        if (this.value == '' && this.numericFeatures.length != 0) {
            this.value = this.numericFeatures[0]
        }
        if (this.value == '' || this.value_y == '') {
            return [];
        }
        if (this.classifierValue == '') {
          this.classifierValue = this.classifiers[0]
        }
        let feature = this.value;
        let feature_y = this.value_y;
        let instances = this.instances;
        let intervals = 10;
        let featureList = [];
        let featureYList = [];
        let feature_min = 100000;
        let feature_max = -100000;
        let featureY_min = 100000;
        let featureY_max = -100000;
        instances.forEach((i)=>{
            let feature_value = 0
            let featureY_value = 0
            if (this.value.substring(0,10) == 'prediction') {
              let classifier = this.value.substring(11,this.value.length) 
              feature_value = instanceById(i)['continuous_predictions'][classifier]
            } else {
              feature_value = parseFloat(instanceById(i)['features'][feature].toString());
            }
            if (this.value_y.substring(0,10) == 'prediction') {
              let classifier = this.value_y.substring(11,this.value_y.length) 
              featureY_value = instanceById(i)['continuous_predictions'][classifier]
            } else {
              featureY_value = parseFloat(instanceById(i)['features'][feature_y].toString());
            }
            featureList.push(feature_value)
            featureYList.push(featureY_value)
            feature_min = feature_min > Math.floor(feature_value) ? Math.floor(feature_value) : feature_min;
            feature_max = feature_max < Math.ceil(feature_value) ? Math.ceil(feature_value) : feature_max;
            featureY_min = featureY_min > Math.floor(featureY_value) ? Math.floor(featureY_value) : featureY_min;
            featureY_max = featureY_max < Math.ceil(featureY_value) ? Math.ceil(featureY_value) : featureY_max;
        })
        let feature_diff = (feature_max - feature_min) / 10;
        let featureY_diff = (featureY_max - featureY_min) / 10;
        
        let featureIntervals = [];
        let featureYIntervals = [];
        let count = 0;
        let begin = feature_min;
        let beginY = featureY_min;
        while (count <= 10) {
            featureIntervals.push(parseFloat(begin.toFixed(1)))
            featureYIntervals.push(parseFloat(beginY.toFixed(1)))
            begin += feature_diff
            beginY += featureY_diff
            count += 1
        }
        let scatter_matrix = []
        featureYIntervals.forEach((featureY, i)=>{
            scatter_matrix[i] = []
            featureIntervals.forEach((feature, j)=>{
                scatter_matrix[i].push([])
            }) 
        })
        instances.forEach((i)=>{
            let feature_value = 0
            let featureY_value = 0
            if (this.value.substring(0,10) == 'prediction') {
              let classifier = this.value.substring(11,this.value.length) 
              feature_value = parseFloat(instanceById(i)['continuous_predictions'][classifier])
            } else {
              feature_value = parseFloat(instanceById(i)['features'][feature].toString());
            }
            if (this.value_y.substring(0,10) == 'prediction') {
              let classifier = this.value_y.substring(11,this.value_y.length) 
              featureY_value = parseFloat(instanceById(i)['continuous_predictions'][classifier])
            } else {
              featureY_value = parseFloat(instanceById(i)['features'][feature_y].toString());
            }
            let feature_idx = parseInt(Math.round((feature_value - feature_min) / feature_diff).toString())
            let featureY_idx = parseInt(Math.round((featureY_value - featureY_min) / featureY_diff).toString())
            scatter_matrix[featureY_idx][feature_idx].push(i)
        })
        
        this.featureIntervals = featureIntervals;
        this.featureYIntervals = featureYIntervals;
        let correlations = [];
        scatter_matrix.forEach((row, i)=>[
            row.forEach((value, j)=>{
                this.max_value = this.max_value < value.length ? value.length : this.max_value;
                correlations.push({ "feature_y": featureYIntervals[i],"feature": featureIntervals[j], "featureY_idx": i, "feature_idx": j, "value":value.length, "instances": value, "zoom":0 })
            })
        ])
        return correlations;
    
    },
    selections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    focusItemId(): String{return  this.$store.state.focusItemId},
    focusDotEmphasis(): String{return  this.$store.state.focusDotEmphasis},
    x(): d3.ScaleBand<string> {
      const x = d3.scaleBand<string>()
              .domain(this.featureIntervals)
              .range([0, this.width])
              .paddingOuter(1)
              .paddingInner(0.3);
      return x
    },
    y(): d3.ScaleBand<string>{
      const y = d3.scaleBand<string>()
              .domain(this.featureYIntervals)
              .range([this.height,0])
              .paddingOuter(1)
              .paddingInner(0.3);
      return y;
    },
    xAxis():any {
      const xAxis = (g: any) => g
            .attr('transform', `translate(${60}, ${this.height})`)
            .call(
              d3.axisBottom(this.x)
                .tickSizeOuter(0),
            );
      return xAxis;
    }
  },
  watch: {
    zoom() {
      this.updateCorrelations();
      this.drawInitial();
    },
    selections() {
      this.drawInitial();
    },
    focusItemId(){
      this.drawInitial();
    },
    focusDotEmphasis(){
      this.drawInitial();
    },
    classifierValue() {
      this.updateCorrelations();
      this.drawCorrelation();
    },
    value() {
      this.zoom = {
        type: '' as 'in' | 'out' | '',
        obejct: '',
      };
      this.updateCorrelations();
      this.drawCorrelation();
    },
    value_y() {
      this.zoom = {
        type: '' as 'in' | 'out' | '',
        obejct: '',
      };
      this.updateCorrelations();
      this.drawCorrelation();
    },
    instances() {
      this.drawInitial();
    },
    correlationMode() {
      this.drawCorrelation();
    },
  },
  mounted() {
    this.drawInitial();
  },
  methods: {
    updateCorrelations() {
        this.preCorrelations = []
        this.prefeatureIntervals = []
        this.prefeatureYIntervals = []
        this.premax_value = this.max_value
        let feature = this.value;
        let feature_y = this.value_y;
        let instances = this.zoom['type'] == '' ? this.instances: this.zoom['object']['instances'];
        let intervals = 10;
        let featureList = [];
        let featureYList = [];
        let feature_min = 100000;
        let feature_max = -100000;
        let featureY_min = 100000;
        let featureY_max = -100000;
        this.max_value = -100000;
        this.correlations.forEach((c)=>{
          this.preCorrelations.push(c)
        })
        this.featureIntervals.forEach((f)=>{
          this.prefeatureIntervals.push(f)
        })
        this.featureYIntervals.forEach((f)=>{
          this.prefeatureYIntervals.push(f)
        })
        instances.forEach((i)=>{
            let feature_value = 0
            let featureY_value = 0
            if (this.value.substring(0,10) == 'prediction') {
              let classifier = this.value.substring(11,this.value.length) 
              feature_value = parseFloat(instanceById(i)['continuous_predictions'][classifier])
            } else {
              feature_value = parseFloat(instanceById(i)['features'][feature].toString());
            }
            if (this.value_y.substring(0,10) == 'prediction') {
              let classifier = this.value_y.substring(11,this.value_y.length) 
              featureY_value = parseFloat(instanceById(i)['continuous_predictions'][classifier])
            } else {
              featureY_value = parseFloat(instanceById(i)['features'][feature_y].toString());
            }
            featureYList.push(featureY_value)
            feature_min = feature_min > (feature_value) ? (feature_value) : feature_min;
            feature_max = feature_max < (feature_value) ? (feature_value) : feature_max;
            featureY_min = featureY_min > (featureY_value) ? (featureY_value) : featureY_min;
            featureY_max = featureY_max < (featureY_value) ? (featureY_value) : featureY_max;
        })
        let feature_diff = (feature_max - feature_min) / 10;
        let featureY_diff = (featureY_max - featureY_min) / 10;
        let featureIntervals = [];
        let featureYIntervals = [];
        let count = 0;
        let begin = feature_min;
        let beginY = featureY_min;
        while (count <= 10) {
            featureIntervals.push(parseFloat(begin.toFixed(2)))
            featureYIntervals.push(parseFloat(beginY.toFixed(2)))
            begin += feature_diff
            beginY += featureY_diff
            count += 1
        }
        let scatter_matrix = []
        featureYIntervals.forEach((featureY, i)=>{
            scatter_matrix[i] = []
            featureIntervals.forEach((feature, j)=>{
                scatter_matrix[i].push([])
            }) 
        })
        this.featureIntervals = featureIntervals;
        this.featureYIntervals = featureYIntervals;
        let correlations = [];
        if (this.zoom.type == '') {
          instances.forEach((i)=>{
              let feature_value = 0
            let featureY_value = 0
            if (this.value.substring(0,10) == 'prediction') {
              let classifier = this.value.substring(11,this.value.length) 
              feature_value = parseFloat(instanceById(i)['continuous_predictions'][classifier])
            } else {
              feature_value = parseFloat(instanceById(i)['features'][feature].toString());
            }
            if (this.value_y.substring(0,10) == 'prediction') {
              let classifier = this.value_y.substring(11,this.value_y.length) 
              featureY_value = parseFloat(instanceById(i)['continuous_predictions'][classifier])
            } else {
              featureY_value = parseFloat(instanceById(i)['features'][feature_y].toString());
            }
              let feature_idx = parseInt(Math.round((feature_value - feature_min) / feature_diff).toString())
              let featureY_idx = parseInt(Math.round((featureY_value - featureY_min) / featureY_diff).toString())
              scatter_matrix[featureY_idx][feature_idx].push(i)
          })
          
          scatter_matrix.forEach((row, i)=>{
              row.forEach((value, j)=>{
                  this.max_value = this.max_value < value.length ? value.length : this.max_value;
                  correlations.push({ "feature_y": featureYIntervals[i],"feature": featureIntervals[j], "featureY_idx": i, "feature_idx": j, "value":value.length, "instances": value , "zoom": 0})
              })
          })
        } else {
          instances.forEach((i)=>{
              let feature_value = 0
              let featureY_value = 0
              if (this.value.substring(0,10) == 'prediction') {
                let classifier = this.value.substring(11,this.value.length) 
                feature_value = parseFloat(instanceById(i)['continuous_predictions'][classifier])
              } else {
                feature_value = parseFloat(instanceById(i)['features'][feature].toString());
              }
              if (this.value_y.substring(0,10) == 'prediction') {
                let classifier = this.value_y.substring(11,this.value_y.length) 
                featureY_value = parseFloat(instanceById(i)['continuous_predictions'][classifier])
              } else {
                featureY_value = parseFloat(instanceById(i)['features'][feature_y].toString());
              }
              correlations.push({ "feature_y": featureY_value,"feature": feature_value, "featureY_idx": '', "feature_idx": '', "value":1, "instances": new Set([i]), "zoom": 0})
          })
        }
        
        this.correlations =  correlations;
    },
    drawInitial() {
      // @ts-ignore
      d3.select(this.$refs.svg).selectAll('*').remove();
      // @ts-ignore
      const svgAll = d3.select(this.$refs.svg).append('svg')
        .attr('width', '100%')
        .attr('viewBox', `0 0
          ${(this.width + this.margin.left + this.margin.right)}
          ${(this.height + this.margin.top + this.margin.bottom +  this.margin.left)}`)
      const svg_correlations = svgAll.append('g')
          .attr("class","svg-correlations")
          .attr('transform',`translate(${0}, ${this.margin.top + this.margin.left })`)     ;
      if (this.correlations.length == 0) {
        this.correlations = this.InitialCorrelations
      }
      
      this.drawCorrelation();      
    },
    drawCorrelation() { 
      if (this.correlations.length == 0) {
        this.correlations = this.InitialCorrelations
      }
      const chart = d3.select(this.$refs.svg);
      const svg = chart.select(".svg-correlations")
      const correlationMode = this.correlationMode;
      svg.selectAll('*').remove();  
      const sequentialScale = d3.scaleSequential<string>( d3.interpolateGreys)
        .domain([0, 1.5* this.max_value])
        .interpolator(function (x) { return d3.interpolateGreys(1.5*x);} );
      const drawTitles = () =>{
          svg.append('text')
            .attr('transform', () => {
                const xOffset = this.width / 2;
                const yOffset = this.height + this.margin.bottom;
                return `translate(${xOffset}, ${yOffset})`;
            })
            .style('text-anchor', 'middle')
            .style('font-size', '24px')
            .text('Feature: ' + this.value);
          svg.append('text')
            .attr('transform', () => {
                const xOffset = 100;
                const yOffset = -40;
                return `translate(${xOffset}, ${yOffset})`;
            })
            .style('text-anchor', 'middle')
            .style('font-size', '24px')
            .text('Feature: ' + this.value_y);
      }
      drawTitles();
      const drawRects = () => {
          let x = this.x;
          let y = this.y;
          let xAxis = this.xAxis;
          svg.append('g')
            .call(xAxis)
            .attr('font-size', 18)
            .selectAll('text')
            .attr('transform', 'rotate(30)')
            .attr('text-anchor', 'start');
          svg.append("g")
              .attr("transform", "translate(60," + 0 + ")")
              .call(d3.axisLeft(y))
              .attr('font-size', 18);
          
          
          const barCells  = svg.append('g')
            .attr("transform", "translate(60, " + (-this.height / 15) + ")")
            .selectAll("rects")
            .data(this.correlations)
            .enter();
          this.svg = svg;
          barCells
            .append("rect")
            .attr("x", function (d) { return x(d['feature']); } )
            .attr("y", function (d) { return y(d['feature_y']); } )
            .attr("width", this.width / 15)
            .attr("height", this.height / 15)
            .style("fill", (d)=>{
                return sequentialScale(d['value'])
            })
            .on('click', (d: string) => this.click(d))
            .on('contextmenu', (d: string) => this.select(d, 'second'));
           
      }
      const drawZoomin = () => {
        const x = d3.scaleLinear()
          .domain([parseFloat(d3.min(this.featureIntervals)) * 0.95, parseFloat(d3.max(this.featureIntervals)) * 1.05])
          .range([ 0, this.width]);
        const y = d3.scaleLinear()
          .domain([parseFloat(d3.min(this.featureYIntervals)) * 0.95, parseFloat(d3.max(this.featureYIntervals)) * 1.05])
          .range([this.height, 0]);
        const xAxis = (g: any) => g
          .attr('transform', `translate(${60}, ${this.height})`)
          .call(
            d3.axisBottom(x)
              .tickSizeOuter(0),
          );
        svg.append('g')
          .call(xAxis)
          .attr('font-size', 18)
          .selectAll('text')
          .attr('transform', 'rotate(30)')
          .attr('text-anchor', 'start');
        svg.append("g")
              .attr("transform", "translate(60," + 0 + ")")
              .call(d3.axisLeft(y))
              .attr('font-size', 18);
        const barCells  = svg.append('g')
            .attr("transform", "translate(60, " + (-this.height / 15) + ")")
            .selectAll("rects")
            .data(this.correlations)
            .enter();
        barCells
          .append("circle")
          .attr("cx", function (d) { return x(d['feature']); } )
          .attr("cy", function (d) { return y(d['feature_y']); } )
          .attr("r", (d)=> 15 * d['value'])
          .style("fill", (d)=> {
            return (d['instances'].has(this.$store.state.focusItemId)) ? colors.focus:'steelblue'
            })
          .attr('opacity',0.5)
          .on('click', (d: string) => {
            this.$store.dispatch(
              "setFocusItem",
                [...d['instances']][0]
            );
          })
          .on('contextmenu', (d: string) => {
            this.select(d, 'second')
            })
         const drawOverallView = () =>{
            var x = d3.scaleBand<string>()
              .domain(this.prefeatureIntervals)
              .range([0, this.width  / 5])
              .paddingOuter(1)
              .paddingInner(0.3);
            var y = d3.scaleBand<string>()
                .domain(this.prefeatureYIntervals)
                .range([this.height / 5,0])
                .paddingOuter(1)
                .paddingInner(0.3);
            var xAxis = (g: any) => g
              .attr('transform', `translate(${this.width-60}, ${this.height / 5})`)
              .call(
                d3.axisBottom(x)
                  .tickSizeOuter(0),
              );
            svg.append('g')
              .call(xAxis)
              .attr('font-size', 4)
              .selectAll('text')
              .attr('transform', 'rotate(30)')
              .attr('text-anchor', 'start');
            svg.append("g")
                .attr("transform", "translate(" +(this.width-60) + ','+ 0 + ")")
                .call(d3.axisLeft(y))
                .attr('font-size', 4);
                        
            const barCells  = svg.append('g')
              .attr("transform", "translate(" +(this.width-60) + ','+ (-this.height / 75) + ")")
              .selectAll("rects")
              .data(this.preCorrelations)
              .enter();
            barCells
              .append("rect")
              .attr("x", function (d) { return x(d['feature']); } )
              .attr("y", function (d) { return y(d['feature_y']); } )
              .attr("width", this.width / 75)
              .attr("height", this.height / 75)
              .style("fill", (d)=>{
                if (this.zoom.object == d) {
                  return 'steelblue'
                }
                  return 'lightgrey'
              })
              .attr("visibility",d=>d['value'] == 0? 'hidden':'visible')
              .on('click', d=>this.zoom = ({type: '', 'object':''}))
         }
         drawOverallView();
          
      }
      if (this.zoom.type == '') {
        drawRects();
        this.drawSelections();
      } else {
        drawZoomin();
      }
      
    },
    drawSelections() {
        if (this.correlations.length == 0) {
          this.correlations = this.InitialCorrelations
        }
        const { first, second } = this.selections;
        const barYOffset = (instances: Set<string>, selection: Set<string>) => {
            const overlappingInstances = intersection(instances, selection);
            return overlappingInstances.size / instances.size * (this.height / 15);
        };
        const hasFocusItem = (instances: Set<string>, selection: Set<string>) => {
        const overlappingInstances = intersection(instances, selection);
        for (const id of overlappingInstances) {
          if(this.$store.state.focusItemId === id) return true
        }
        return false
      }
        const selections = [first, second];
        const x = this.x;
        const y = this.y;
        let barWidth = this.width / 15;
        let selectionBarWidth  = barWidth / 6;
        selections.forEach((cur_selection, idx)=>{
          if (!cur_selection) {
            this.svg.selectAll('selection-rect-'+idx).attr('height', '0');
            this.svg.selectAll('selection-circle-'+idx).attr("visibility","hidden");
          } else {
            this.correlations.forEach((d)=>{
              
              let selection_attributes = {
                barCells : this.svg,
                x : 60 + x(d['feature']) + (idx+1) * selectionBarWidth,
                y : (-this.height / 15) + y(d['feature_y']) ,
                width : selectionBarWidth,
                height : barYOffset(new Set(d['instances']), cur_selection.instances),
                r  : selectionBarWidth / 2,
                color : idx == 0? this.selection1Color : this.selection2Color,
                circle_visibility : barYOffset(new Set(d['instances']), cur_selection.instances) > 0 && barYOffset(new Set(d['instances']), cur_selection.instances) < barWidth * 0.1 ? 'visible':'hidden',
                cx : 60 + x(d['feature'])  + selectionBarWidth * 2 + (idx - 1/2) * selectionBarWidth,
                cy : (-this.height / 15)+ y(d['feature_y'])  + selectionBarWidth / 2,
                selection_type: idx,
                focused: hasFocusItem(new Set(d['instances']), cur_selection.instances),
                view_name : this.name
              }
              this.$store.dispatch('drawSelections',selection_attributes)
            })
          }
        })
    },
    select(
      group: string,
      whichOverlap: 'first' | 'second',
    ) {
      if(whichOverlap === 'second') {
        d3.event.preventDefault();
        d3.event.stopPropagation();
      }
      const classifier = this.classifierValue;
      const feature_name = this.value;
      const featureY_name  = this.value_y;
      const feature = group['feature'];
      const feature_y = group['feature_y'];
      const description = `Instances whose ${feature_name} are around ${feature} and ${featureY_name} are around ${feature_y} `;
      
      const instances = new Set (group['instances'])
      const constraint = blankConstraint();
      constraint.rule = Rule.RIGHT;
      constraint.classifier = classifier;
   
      const predicate: PredicateSimple = {
        type: 'simple',
        constraints: [constraint],
        metric: []
      };
      const payload = {
        description,
        instances,
        predicate,
      };
      this.$store.dispatch('prependToSelectionHistory', payload);
      this.$store.dispatch('changedMostRecentSelection', whichOverlap);
    },
    click(item){
      this.clickCount += 1
      if (this.clickCount === 1) {
          this.clickTimer = setTimeout(function(context) {
              context.clickCount = 0
              context.select(item, 'first');
          }, 300, this)
      } 
      if (this.clickCount === 2) {
          clearTimeout(this.clickTimer);
          this.clickCount = 0
          this.zoom = ({type: 'in', 'object':item})
      }
    }
  },
});
</script>


<style scoped>
.card {
  background-color: white;
}
.select_feature {
  float: left;
  width: 30%;
}
.select_classifier {
  float: left;
  width: 30%;
}
.select_feature_y {
  float: left;
  width: 30%;
}
</style>