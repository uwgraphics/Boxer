<template>
  <div class="card">
    <v-expansion-panels
      v-model="panel"
    >
      <v-expansion-panel>
        <v-expansion-panel-header>
          <div class="handle" style="font-size: 20px;">
            <v-icon
                style="margin-right: 10px;"
                @click="onClose"
            >close</v-icon>
            <span>Reliability Curve</span>
          </div>
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <div style="margin: 0px 30px;">
            <v-radio-group v-model="selection_mode" label="Selection Mode">
              <v-radio label="overall curve " value="overall"></v-radio>
              <v-radio label="selection curve" value="selected"></v-radio>
            </v-radio-group>
          </div>
          </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
    <div id="legend1" >
    <multiselect v-model="value" :options="options" 
      :multiple="true" 
      :close-on-select="false" 
      :clear-on-select="false" 
      :preserve-search="true" 
      placeholder="Pick sets" label="name" track-by="name" 
      :preselect-first="true">
    </multiselect>
    
    </div>
    <div ref="svg" />

  </div> 
  
</template>
<script src="d3.parcoords.js"></script>
<script src="d3.legend.js"></script>

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
import { select } from 'd3';

interface MetricsWithClassifier {
  classifier: string;
  metrics: Metrics;
}

export default Vue.extend({
  name: 'Reliability_Curve',
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
      classifier: '',
    };
    const click = {
      classifier: '',
      threshold: ''
    };  
    const selection_mode = 'overall' as 'overall' | 'selected'

    return {
      svg: '',
      confidenceClassifierDict: {},
      value: [],
      selection_mode,
      accuracySorting,
      height,
      hover,
      click,
      margin,
      curclick:[],
      panel: [],
      rightColor: '#b8ddf2',
      width,
      selectedEval:'',
      wrongColor: '#f7c8aa',
      rightColor1: '#9bcae4',
      wrongColor1: '#ffbb99',
      rightHoverColor1: '#4ba0ce',
      wrongHoverColor1: '#ff884d',
      rightHoverColor: '#4393c3',
      wrongHoverColor: '#d6604d',
      selection1Color: '#18FFFF',
      selection2Color: '#FF4081',
    };
  },
  computed: {
    saveStatus() {
      return this.$store.state.saveStatus;
    },
    options(): any[] {
      let options = []
      const classifiers = this.classifiers
      classifiers.forEach((c)=>{
        options.push({name: c});
      })
      return options
    },
    classifierThresholds():{} {
      return this.$store.state.classifierThresholdDict;
    },
    classes(): string[] {
      return [...this.boxProps.classes];
    },
    confidence(): string[] {
      return ["0","0.1","0.2","0.3","0.4","0.5","0.6","0.7","0.8","0.9","1.0"]
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
    features(): string[] {
      return [...this.boxProps.features];
    },
    instances(): string[] {
      return [...this.boxProps.instances];
    },
    confidenceIndex() : {} {
      let confidenceIndex  = {}
      for (let i in this.confidence) {
        confidenceIndex[this.confidence[i]] = parseInt(i)
      }
      return confidenceIndex
    },
    metrics(): MetricsWithClassifier[] {
      const storeMetrics: {
        [classifier: string]: Metrics,
      } = this.$store.getters.metrics;

      const metrics: MetricsWithClassifier[] = Object.entries(storeMetrics).map(([classifier, m]) => {
        return {
          classifier,
          metrics: m,
        };
      });
      return metrics;
    },
    predictions(): {
      [classifier: string]: {
        name: String,
        threshold: Number,
        acc: Number,
        ci_tp: Number[],
        ci_fn: Number[],
        ci_tn: Number[],
        ci_fp: Number[],
        ci_tp_instances: {
          [confidence: string]:{
            instances: Set<String>,
          }
        },
        ci_fn_instances: {
          [confidence: string]:{
            instances: Set<String>,
            }
          },
          ci_fp_instances: {
          [confidence: string]:{
            instances: Set<String>,
          }
        },
        ci_tn_instances: {
          [confidence: string]:{
            instances: Set<String>,
            }
          },
        continuous_pred: Number[]
      },
    }{
      const predictions: {
        [classifier: string]: {
          name: String,
          threshold: Number,
          acc: Number,
          ci_tp: Number[],
          ci_fn: Number[],
          ci_tn: Number[],
          ci_fp: Number[],
          ci_tp_instances: {
          [confidence: string]:{
            instances: Set<String>,
            }
          },
          ci_fp_instances: {
          [confidence: string]:{
            instances: Set<String>,
            }
          },
          ci_tn_instances: {
          [confidence: string]:{
            instances: Set<String>,
            }
          },
          ci_fn_instances: {
          [confidence: string]:{
            instances: Set<String>,
            }
          },
          continuous_pred: Number[]
        },
      } = {};


      var allIntervals = [];
      this.classifiers.forEach((c) => {
        let cur_acc = 0
        predictions[c] = {
          name:c,
          threshold: Object.keys( this.classifierThresholds).includes(c)? this.classifierThresholds[c] : 0,
          acc: 0,
          ci_tp: [],
          ci_fn: [],
          ci_tn: [],
          ci_fp: [],
          ci_tp_instances: {},
          ci_fp_instances: {},
          ci_tn_instances: {},
          ci_fn_instances: {},
          continuous_pred: []
        };
        this.confidence.forEach((conf)=>{
          predictions[c]["ci_tp_instances"][conf] = {
            instances: new Set(),
          }
          predictions[c]["ci_tn_instances"][conf] = {
            instances: new Set(),
          }
          predictions[c]["ci_fp_instances"][conf] = {
            instances: new Set(),
          }
          predictions[c]["ci_fn_instances"][conf] = {
            instances: new Set(),
          }
        })
        this.instances.forEach((id)=>{
          let continuous_value = (instanceById(id).continuous_predictions[c])
          let correct = instanceById(id).actual == instanceById(id).predictions[c]? 1 : 0;
          predictions[c].continuous_pred.push(parseFloat(continuous_value))
          let interval = (continuous_value.split(".")[1].substring(0,1)/10).toString()
          if ((continuous_value.split(".")[0]=='1')) {
            interval = "1.0"
          }
          let interval_index = this.confidenceIndex[interval]
          if (interval_index > 0 && interval_index < this.confidence.length) {
            let latter_index = interval_index + 1
            let latter_confi = parseFloat(this.confidence[latter_index])
            if (Math.abs(latter_confi - parseFloat (continuous_value)) < Math.abs(parseFloat (continuous_value) - parseFloat(interval))) {
              interval = this.confidence[latter_index]
            }
          }  

          if (correct == 1){
            if (instanceById(id).actual == this.classes[1]){
              predictions[c]["ci_tp_instances"][interval].instances.add(id)
            } else {
              predictions[c]["ci_tn_instances"][interval].instances.add(id)
            }
          }
            
          else{
            if (instanceById(id).actual == this.classes[1]) {
              predictions[c]["ci_fp_instances"][interval].instances.add(id)
            } else {
              predictions[c]["ci_fn_instances"][interval].instances.add(id)
            }
          }
            
        })
        this.confidence.forEach((conf)=>{
          predictions[c]["ci_tp"].push(predictions[c]["ci_tp_instances"][conf].instances.size)
          predictions[c]["ci_tn"].push(predictions[c]["ci_tn_instances"][conf].instances.size)
          predictions[c]["ci_fp"].push(predictions[c]["ci_fp_instances"][conf].instances.size)
          predictions[c]["ci_fn"].push(predictions[c]["ci_fn_instances"][conf].instances.size)
          allIntervals.push(predictions[c]["ci_tn_instances"][conf].instances.size + predictions[c]["ci_tp_instances"][conf].instances.size + predictions[c]["ci_fn_instances"][conf].instances.size + predictions[c]["ci_fp_instances"][conf].instances.size)
        })
      });
      this.x.domain([0,d3.max(allIntervals)*2])
      return predictions;
    },
    confidenceDict(): {} {
      let confidenceData = []
      let confidenceDict = {}
      this.classifiers.forEach((c)=>{
        let ci_tp = this.predictions[c].ci_tp;
        let ci_tn = this.predictions[c].ci_tn;
        let ci_fp = this.predictions[c].ci_fp;
        let ci_fn = this.predictions[c].ci_fn;
        let curConfidenceData = []
        for (var i in this.confidence) {
          curConfidenceData.push({"classifier":c,"confidence":this.confidence[i], "tp_interval":ci_tp[i], "tn_interval":ci_tn[i], "fp_interval":ci_fp[i], "fn_interval":ci_fn[i]})
        }
        confidenceData.push({"name":c, "data":curConfidenceData,"threshold":this.predictions[c].threshold})
        confidenceDict[c] = curConfidenceData
      })
      return confidenceDict;
    },
    selections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    focusItemId(): String{return  this.$store.state.focusItemId},
    focusDotEmphasis(): String{return  this.$store.state.focusDotEmphasis},
    x(): d3.ScaleLinear<number, number> {
      const x = d3.scaleLinear()
        .range([0, this.width / this.classifiers.length])
        .domain([0,100])
      return x;    
    },
    xRight(): d3.ScaleLinear<number, number> {
      const x = d3.scaleLinear()
        .range([0, this.width / this.classifiers.length])
        .domain([0,1])
      return x;    
    },
    y(): d3.ScaleBand<string> {
      const y = d3.scaleBand<string>()
        .range([this.height, 0])
        .padding(0.1).domain(this.confidence);
      return y;
    },
    outSelections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    resumeStatus() {
      return this.$store.state.resumeStatus
    },
  },
  watch: { 
    resumeStatus() {
      let viewsConfig = this.$store.state.viewsConfig;
      viewsConfig.forEach((view)=>{
        if (view.name == 'Reliability_Curve') {
          if (view.config) {
            let value  = view.config;
            this.value = []
            value.classifiers.forEach((c)=>{
              if (this.classifiers.includes(c)) {
                this.value.push({'name':c})
              }
            })
            this.selection_mode = value.selection
          }
        }
      })
      this.drawInitial();
    },
    saveStatus() {
      let config = {"name":"Reliability_Curve", 
                    "config": {
                      "classifiers":this.value.map((c)=>c.name),
                      "selection":this.selection_mode}}
      this.$store.dispatch("changedSaveConfig",config)
    },
    click() {
      this.updateThreshold();
    },
    selections() {
      this.drawInitial();
    },
    value() {
      this.drawInitial();
    },
    selection_mode() {
      this.drawInitial();
    },
    outSelections() {
      if (this.selection_mode != 'overall') {
        this.drawInitial();
      }
    },
    hover() {
      this.drawHover();
    },
    instances() {
      this.drawInitial();
    },
    focusItemId(){
      this.drawInitial();
    },
    focusDotEmphasis(){
      this.drawInitial();
    },
  },
  mounted() {
    let viewsConfig = this.$store.state.viewsConfig;
    viewsConfig.forEach((view)=>{
      if (view.name == 'Reliability_Curve') {
        if (view.config) {
          let value  = view.config;
          this.value = []
          value.classifiers.forEach((c)=>{
            if (this.classifiers.includes(c)) {
              this.value.push({'name':c})
            }
          })
          this.selection_mode = value.selection
        }
      }
    })
    this.drawInitial();
  },
  methods: {
    updateThreshold() {
      const classifier = this.click.classifier;
      const value = parseFloat(this.click.threshold).toFixed(2);
      let changedClassifier = {"classifier":classifier, "single_threshold": parseFloat(value) * 100};
      this.$store.dispatch("changedCurveChosenClassifierThresholdTuple",changedClassifier)
    },
    clearHover() {
      this.hover = ({ classifier: ''});
    },
    drawHover() {
      const name = this.hover.classifier;
      let classifiers = ['standard']
      this.classifiers.forEach((c)=> {
        classifiers.push(c)
      });
      const {first, second} = this.outSelections
      if (this.selection_mode == 'overall') {
        if (this.hover.classifier != '') {
          d3.select(".legend_circle_"+name).attr("r",8)
          d3.select(".legend_text_"+name).style("font-size", "20px")
          classifiers.forEach((c)=>{
            if (c != name) {
              d3.selectAll(".line_"+c).style("opacity",0.2)
              d3.selectAll(".dot_"+c).style("opacity",0.2)
            }
          })
        } else {
          classifiers.forEach((c)=>{
            d3.selectAll(".line_"+c).style("opacity",1)
            d3.selectAll(".dot_"+c).style("opacity",1)
            d3.select(".legend_circle_"+c).attr("r",6)
            d3.select(".legend_text_"+c).style("font-size", "15px")
          })
        }
      } else {
        let selectedSets = []
        if (first) {
          selectedSets.push(1)
        }
        if (second) {
          selectedSets.push(2)
        }
        selectedSets.forEach((seleted_type)=>{
          if (this.hover.classifier != '') {
            d3.select(".legend_circle_"+name).attr("r",8)
            d3.select(".legend_text_"+name).style("font-size", "20px")
            d3.selectAll(".line_"+name + "_" + seleted_type).style("opacity",1)
            d3.selectAll(".dot_"+name + "_" + seleted_type).style("opacity",1)
            classifiers.forEach((c)=>{
              if (c != name) {
                d3.selectAll(".line_"+c + "_" + seleted_type).style("opacity",0.2)
                d3.selectAll(".dot_"+c + "_" + seleted_type).style("opacity",0.2)
              }
            })
          } else {
            classifiers.forEach((c)=>{
              d3.selectAll(".line_"+c + "_" + seleted_type).style("opacity",1)
              d3.selectAll(".dot_"+c + "_" + seleted_type).style("opacity",1)
              d3.select(".legend_circle_"+c).attr("r",6)
              d3.select(".legend_text_"+c).style("font-size", "15px")
            })
          }
        })
      }
    },
    drawInitial() {
      // @ts-ignore
      d3.select(this.$refs.svg).selectAll('*').remove();
      // @ts-ignore
      const svg = d3.select(this.$refs.svg).append('svg')
        .attr('width', '100%')
        .attr('viewBox', `0 0
          ${this.width + this.margin.left + this.margin.right}
          ${this.height + this.margin.bottom}`)
        .append('g')
          .attr('transform', `translate(${this.margin.left}, ${this.margin.bottom})`);

      const svg_distribution= d3.select(this.$refs.svg).append('svg')
        .attr('width', '100%')
        .attr('viewBox', `0 0
          ${this.width + this.margin.left + this.margin.right}
          ${(this.height + this.margin.top + this.margin.bottom)*0.4}`)
        .append('g')
          .attr('transform', `translate(${this.margin.left}, ${this.margin.top * 0.2})`);

      const sequentialScale = d3.scaleSequential<string>( d3.interpolatePlasma)
            .domain([0, this.classifiers.length])
            .interpolator(function (x) { return d3.interpolatePlasma(.8*x);} );

      const classifiers = this.value.map((c)=>c.name);

      var width = this.width;
      var height = this.height
      let confidenceData = []
      let confidenceCountData = []
      let confidenceDict = {}
      let selectedDataDict = []
      let count  = 0

      const calculatedCurves = () => {  
        let count = 0
        classifiers.forEach((c)=>{
          count += 1
          let ci_tp = this.predictions[c].ci_tp;
          let ci_tn = this.predictions[c].ci_tn;
          let ci_fp = this.predictions[c].ci_fp;
          let ci_fn = this.predictions[c].ci_fn;
          let curConfidenceData = []
          let cordinates = []
          let curConfidenceCountData = []
          for (var i in this.confidence) {
            if ((ci_tp[i] + ci_fp[i] + ci_tn[i] + ci_fn[i]) == 0 || (ci_tp[i] + ci_fp[i]) / this.instances.size < 0.01 ) {
              curConfidenceCountData.push({"name":c, "color":sequentialScale(count),"classifier":c,"confidence":this.confidence[i],  "value": null})
              continue
            } 
           
            else {
              let value = (ci_tp[i] + ci_fp[i] + ci_tn[i] + ci_fn[i]) == 0 ? null : (ci_tp[i] + ci_fp[i]) / (ci_tp[i] + ci_fp[i] + ci_tn[i] + ci_fn[i])
              let value2 = ci_tp[i] + ci_fp[i] + ci_tn[i] + ci_fn[i]
              curConfidenceData.push({"name":c, "color":sequentialScale(count),"classifier":c,"confidence":this.confidence[i], "tp_interval":ci_tp[i], "tn_interval":ci_tn[i],"fp_interval":ci_fp[i], "fn_interval":ci_fn[i], "threshold":this.predictions[c].threshold, "value": value})
              cordinates.push([this.confidence[i], value])
              curConfidenceCountData.push({"name":c, "color":sequentialScale(count),"classifier":c,"confidence":this.confidence[i],  "value": value2})
            }
          }
          confidenceData.push({"name":c, "color":sequentialScale(count), 'cordinates':cordinates, "data":curConfidenceData,"threshold":this.predictions[c].threshold})
          confidenceCountData.push({"name":c, "color":sequentialScale(count), "data":curConfidenceCountData,"threshold":this.predictions[c].threshold})
          confidenceDict[c] = curConfidenceData
        })

        let confidenceStandard = []
        for (var i in this.confidence) {
          let value = parseFloat(this.confidence[i])
          confidenceStandard.push({"name":"standard", "color":"grey","classifier":"standard","confidence":this.confidence[i], "tp_interval":this.instances.length / 2, "tn_interval":0,"fp_interval":0, "fn_interval":this.instances.length / 2,"threshold":0.5,"value":value})
        }
        confidenceData.push({"name":"standard", "color":"grey", "data":confidenceStandard,"threshold":0.5})
      };

      const calculatedSelectedCurves = () => {
        const {first, second} = this.outSelections;
        const instances = this.instances;
        let selectedconfidenceData = [];
        let selectedconfidenceDict = {};

        const calculate_value = (classifier:string, selection: Set<string>) => {
          let c = classifier
          let ci_tp = []
          let ci_tn = []
          let ci_fp = []
          let ci_fn = []
          for (var idx in this.confidence) {
            let i = this.confidence[idx]
            ci_tp.push(intersection(this.predictions[c].ci_tp_instances[i].instances, selection).size);
            ci_tn.push(intersection(this.predictions[c].ci_tn_instances[i].instances, selection).size);
            ci_fp.push(intersection(this.predictions[c].ci_fp_instances[i].instances, selection).size);
            ci_fn.push(intersection(this.predictions[c].ci_fn_instances[i].instances, selection).size);
          }
          let curConfidenceData = []
          let cordinates = []
          for (var i in this.confidence) {
            if ((ci_tp[i] + ci_fp[i] + ci_tn[i] + ci_fn[i]) == 0) {
              continue
            }
            let value = (ci_tp[i] + ci_fp[i] + ci_tn[i] + ci_fn[i]) == 0 ? null : (ci_tp[i] + ci_fp[i]) / (ci_tp[i] + ci_fp[i] + ci_tn[i] + ci_fn[i])
            let value2 = ci_tp[i] + ci_fp[i] + ci_tn[i] + ci_fn[i]
            curConfidenceData.push({"name":c, "color":sequentialScale(count),"classifier":c,"confidence":this.confidence[i], "tp_interval":ci_tp[i], "tn_interval":ci_tn[i],"fp_interval":ci_fp[i], "fn_interval":ci_fn[i], "threshold":this.predictions[c].threshold, "value": value})
            cordinates.push([this.confidence[i], value])
          }
          selectedconfidenceData.push({"name":c, "color":sequentialScale(count), 'cordinates':cordinates, "data":curConfidenceData,"threshold":this.predictions[c].threshold})
          return curConfidenceData
        };

        count = 0

        let confidenceStandard = []

        if (first) {
          count = 0
          classifiers.forEach((c)=>{
            count += 1;
            selectedconfidenceDict[c] = calculate_value(c, first.instances)            
          })
          for (var i in this.confidence) {
            let value = parseFloat(this.confidence[i])
            confidenceStandard.push({"name":"standard", "color":"grey","classifier":"standard","confidence":this.confidence[i], "tp_interval":this.instances.length / 2, "tn_interval":0,"fp_interval":0, "fn_interval":this.instances.length / 2,"threshold":0.5,"value":value})
          }
          selectedconfidenceData.push({"name":"standard", "color":"grey", "data":confidenceStandard,"threshold":0.5})
          selectedDataDict.push({"selection_type":1, 'data': selectedconfidenceData, "dict": selectedconfidenceDict})
        } 
        if (second) {
          count = 0
          selectedconfidenceDict = {}
          selectedconfidenceData = []
          classifiers.forEach((c)=>{
            count += 1;
            selectedconfidenceDict[c] = calculate_value(c, second.instances)            
          })
          if (! first) {
            let confidenceStandard = []
            for (var i in this.confidence) {
              let value = parseFloat(this.confidence[i])
              confidenceStandard.push({"name":"standard", "color":"grey","classifier":"standard","confidence":this.confidence[i], "tp_interval":this.instances.length / 2, "tn_interval":0,"fp_interval":0, "fn_interval":this.instances.length / 2,"threshold":0.5,"value":value})
            }
            selectedconfidenceData.push({"name":"standard", "color":"grey", "data":confidenceStandard,"threshold":0.5})
          }
          selectedDataDict.push({"selection_type":2, 'data': selectedconfidenceData, "dict": selectedconfidenceDict})
        }

      };

      const drawDistribution = () => {

        let confidenceClassifierDict = {}
        
        for (let i in this.confidence){
          let tmp_list = []
          let j = 0
          classifiers.forEach((d)=>{
            tmp_list.push(confidenceCountData[j].data[i]) 
            j+=1
          })
          confidenceClassifierDict[this.confidence[i]] = tmp_list
        } 
        const xValue = (g: any) => g
          .attr('transform', `translate(${0}, ${height*0.4})`)
          .call(
            d3.axisBottom(xAxis)
              .tickSizeOuter(0),
          );

        const yValue = d3.scaleLinear()
          .domain([0,this.instances.length])
          .range([this.height*0.4, 0]);

        const xAxis = d3.scaleBand<string>()
          .range([0, this.width])
          .paddingOuter(0)
          .domain(this.confidence);

        const x = d3.scaleBand()
          .range([0, this.width / this.confidence.length])
          .paddingOuter(0.5)
          .paddingInner(0)
          .domain(classifiers)
        const y = d3.scaleLinear()
            .domain([0, this.instances.length])
            .range([this.height*0.4, 0]);
        
        const barWidth = x.bandwidth();

        // Add the X Axis
        svg_distribution.append('g')
          .attr("class","bar-chart")
          .call(xValue)
          .selectAll('text')
          .attr('text-anchor', 'start');

        // Add the Y Axis
        svg_distribution.append("g")
            .attr("class","bar-chart")
            .call(d3.axisLeft(yValue)); 
             
        const barCells =  svg_distribution.append("g").attr("class","bar-chart")
        .selectAll("g")
          .data(this.confidence)
          .enter().append("g")
            .attr("transform", function(d: string) { 
              return "translate(" + xAxis(d) + ",0)"; })
            .selectAll("rect")
            .data(function(d: string) { 
              return confidenceClassifierDict[d]; })
            .enter()

        this.svg = svg_distribution;

        this.confidenceClassifierDict = confidenceClassifierDict;

        barCells
          .append("rect")
          .attr("transform", function(d: string) { 
              return "translate(" + x(d['classifier']) + ",0)"; })
          .attr("class",d=>'bar-right-'+d['classifier']+'-'+d['confidence'])
          .attr("width", barWidth)
          .attr("height",(d)=>this.height * 0.4 -y(d["value"]))
          .attr("y", (d)=>{
            return y(d["value"])})
          .attr("fill",(d:string)=>d['color'])
          .on('mouseenter', (d: string) => this.hover = ({type: 'right1', classifier: d["classifier"], interval: d["confidence"].toString()}))
          .on('mouseleave', this.clearHover)
          .on('click', (d: string) => this.select(d["classifier"],  'first',d["confidence"].toString()))
          .on('contextmenu', (d: string) => this.select(d["classifier"],  'second',d["confidence"].toString()));
      };

      const drawCurves = () => {
        const xValue = d3.scaleLinear()
        .domain([0, 1])
        .range([0, this.width])
        const yValue = d3.scaleLinear()
          .domain([0,1])
          .range([this.height*3/4, 0]);

        // Add the X Axis
        svg.append("g")
            .attr("transform", "translate(0," + height*3/4 + ")")
            .call(d3.axisBottom(xValue));

        // Add the Y Axis
        svg.append("g")
            .call(d3.axisLeft(yValue)); 
        
        function line(d) {
          var name = d.name
          d = d.data
          var path = "M " 
          var lastx = 1;
          var lasty = 0;
          var idx = 0
          d.forEach((cordinate)=>{
            if ((cordinate.value == null || cordinate.value == 0) && idx != 0) {
              idx += 1;
            } else {
                if (idx == 0) {
                  path = path + xValue(cordinate.confidence) + ' ' + yValue(cordinate.value)
                } else {
                  path = path + 'L '+ xValue(cordinate.confidence) +' ' + yValue(cordinate.value)
                }              
                lastx = cordinate.confidence;
                lasty = cordinate.value;
                idx += 1;
            }
            
          })
          return path
        }

        var lines = svg 
          .selectAll("myPath")
          .data(confidenceData)
          .enter().append("path")
          .attr("d",  line)
          .attr("class",(d,i)=>"line_"+d.name)
          .attr("class",(d,i)=>"line_"+d.name)
          .style("fill", "none")
          .attr("stroke",(d)=>{
            return d.color})
          .style("stroke-width", 3)
          .style("opacity", 1)   
          .style("stroke-dasharray",(d)=>d["name"] == "standard"? ("3, 3") : ("0, 0")) 

        var points = svg.selectAll(".dot")
          .data(confidenceData)
          .enter()
          .selectAll(".circle")
          .data(function(d: string) { 
            return d["data"]; })
            .enter()
            .append("circle")
          .attr("class",(d,i)=>"dot_"+d["name"])
          .attr("cx", function(d, i) {  
            let x = parseFloat(d["confidence"]);
            return xValue(x) })
          .attr("cy", function(d,i) { 
            let p = d;
            let y = d["value"]
            return yValue(y) })
          .attr("r", 5)
          .attr("fill",(d)=>d["color"])
          .attr("opacity",function(d,i) { 
            return d['value'] != null && d['value']!= 0 ? 1 : 0
            })
          .on('click', (d,i) =>this.click = {'threshold':d["confidence"], 'classifier':d['classifier']})

      };

      const drawSelectedCurves = () => {
        const xValue = d3.scaleLinear()
        .domain([0, 1])
        .range([0, this.width])
        const yValue = d3.scaleLinear()
          .domain([0,1])
          .range([this.height*3/4, 0]);

        // Add the X Axis
        svg.append("g")
            .attr("transform", "translate(0," + height*3/4 + ")")
            .call(d3.axisBottom(xValue));

        // Add the Y Axis
        svg.append("g")
            .call(d3.axisLeft(yValue)); 
        
        function line(d) {
          var name = d.name
          d = d.data
          var path = "M " 
          var lastx = 1;
          var lasty = 0;
          var idx = 0
          d.forEach((cordinate)=>{
            if ((cordinate.value == null || cordinate.value == 0) && idx != 0) {
              idx = 0
              path = path + 'M '
            }
            if (idx == 0) {
              path = path + xValue(cordinate.confidence) + ' ' + yValue(cordinate.value)
            } else {
              path = path + 'L '+ xValue(cordinate.confidence) +' ' + yValue(cordinate.value)
            }              
            lastx = cordinate.confidence;
            lasty = cordinate.value;
            idx += 1; 
          })
          return path
        }

        let confidenceStandard  = []
        for (var i in this.confidence) {
            let value = parseFloat(this.confidence[i])
            confidenceStandard.push({"name":"standard", "color":"grey","classifier":"standard","confidence":this.confidence[i], "tp_interval":this.instances.length / 2, "tn_interval":0,"fp_interval":0, "fn_interval":this.instances.length / 2,"threshold":0.5,"value":value})
        }
        selectedDataDict. forEach((data)=>{
          let confidenceData = data.data;
          let confidenceDict = data.dict;
          let selection_type = data.selection_type;
          var lines = svg 
            .selectAll("myPath")
            .data(confidenceData)
            .enter().append("path")
            .attr("d",  line)
            .attr("class",(d,i)=>"line_"+d["name"] + "_" + selection_type)
            .style("fill", "none")
            .attr("stroke",(d,i)=>{
              if (d['color'] == 'grey') return d['color']
              if (this.value.length  == 1) {
                return selection_type == 1? this.selection1Color
                    :selection_type == 2? this.selection2Color
                    :d["color"]
              }
              return d["color"]})
            .style("stroke-width", 3)
            .style("opacity", 1)   
            .style("stroke-dasharray", selection_type == '1'? ("3, 3") : ("0, 0"))


          var points = svg.selectAll(".dot")
            .data(confidenceData)
            .enter()
            .selectAll(".circle")
            .data(function(d: string) { 
              return d["data"]; })
              .enter()
              .append("circle")
            .attr("class",(d,i)=>"dot_"+d["name"] + "_" + selection_type)
            .attr("cx", function(d, i) {  
              let x = parseFloat(d["confidence"]);
              return xValue(x) })
            .attr("cy", function(d,i) { 
              let p = d;
              let y = d["value"]
              return yValue(y) })
            .attr("r", 5)
            .attr("fill",(d)=>{
              if (d['color'] == 'grey') return d['color']
              if (this.value.length  == 1) {
                return selection_type == 1? this.selection1Color
                    :selection_type == 2? this.selection2Color
                    :d["color"]
              }
              return d["color"]})
            .attr("opacity",function(d,i) { 
              return d['value'] != null ? 1 : 0
              })
            .on('click', (d,i) =>this.click = {'threshold':d["confidence"], 'classifier':d['classifier']})
        })
        
      };if (this.selection_mode == 'overall') {
        calculatedCurves();
        drawCurves();
        drawDistribution();
        this.drawDistributionSelections();
      } else {
        calculatedSelectedCurves();
        drawSelectedCurves();
        calculatedCurves();
        drawDistribution();
        this.drawDistributionSelections();
      }

      const drawTitles = () => {
        svg.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('x', -this.height / 2)
          .attr('y', -this.margin.left * 0.9)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text("Fraction of Positives"); 
        svg.append('text')
          .attr('transform', () => {
            const xOffset = (this.width) / 2;
            const yOffset = (this.height) * 0.9;
            return `translate(${xOffset}, ${yOffset})`;
          })
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text("Mean predicted value");  
      };
      drawTitles();

      const drawLegend = () => {
        var evaluationKeys = this.evaluationKeys
        if (this.selection_mode != 'overall') {
          confidenceData = selectedDataDict[0].data
        }
        var legend_circle = svg 
          .selectAll("myCicle")
          .data(confidenceData)
          .enter().append("circle")
          .attr("class",(d,i)=>"legend_circle_"+d.name)
          .attr("cx",this.evaluationKeys == "roc"? 10 : 20)
          .attr("cy",(d,i)=>i*25 - this.margin.top)
          .attr("r", 6)
          .style("fill", d=>d.color)
          .on('mouseenter', d=>this.hover = ({classifier:d.name}))
            .on('mouseleave', this.clearHover)


        var legend_text = svg 
          .selectAll("myText")
          .data(confidenceData)
          .enter().append("text")
          .attr("class",(d,i)=>"legend_text_"+d.name)
          .attr("x", this.evaluationKeys == "roc"? 30 : 40)
          .attr("y", (d,i)=>i*25 - this.margin.top)
          .text(d=>d.name)
          .style("font-size", "15px")
          .attr("alignment-baseline","middle")
          .on('mouseenter', d=>this.hover = ({classifier:d.name}))
            .on('mouseleave', this.clearHover) 

         if (this.selection_mode != 'overall') {
           svg 
            .append("line")
            .attr('y1',  -  this.margin.top)
            .attr('x1', 100)
            .attr('x2', 140)
            .attr('y2',  -  this.margin.top)
            .attr('stroke', 'blue')
            .attr('stroke-width', '2px')
            .attr('stroke-opacity', 0.5)
            .style("stroke-dasharray",("3, 3"))
          svg 
            .append("text")
            .attr('y',  -  this.margin.top)
            .attr('x', 142)
            .style("font-size", "15px")
            .attr("alignment-baseline","middle")
            .text("selection 1")

          svg 
            .append("line")
            .attr('y1', 25 -  this.margin.top)
            .attr('x1', 100)
            .attr('x2', 140)
            .attr('y2', 25 -  this.margin.top)
            .attr('stroke', 'blue')
            .attr('stroke-width', '2px')
            .attr('stroke-opacity', 0.5)
          svg 
            .append("text")
            .attr('y', 25 -  this.margin.top)
            .attr('x', 142)
            .style("font-size", "15px")
            .attr("alignment-baseline","middle")
            .text("selection 2")
         }
         
      };
      drawLegend(); 
    },
    drawDistributionSelections() {
      const chart = d3.select(this.$refs.svg);

      const { first, second } = this.selections;
      const confidenceClassifierDict = this.confidenceClassifierDict;
      const classifiers = this.value.map((c)=>c.name);
 
      const xAxis = d3.scaleBand<string>()
          .range([0, this.width])
          .paddingOuter(0)
          .domain(this.confidence);
      const x = d3.scaleBand()
          .range([0, this.width / this.confidence.length])
          .paddingOuter(0.5)
          .paddingInner(0)
          .domain(classifiers)
      const y = d3.scaleLinear()
            .domain([0, this.instances.length])
            .range([ 0, this.height*0.4]);
          
        
      const barWidth = x.bandwidth();

      const selectionHeight = (classifierName:string, confidence: string, selection: Set<string>) => {
        let instances_list = [];
        let all_instances_list = [];
        let name_list = ['ci_fn_instances', 'ci_fp_instances', 'ci_tn_instances', 'ci_tp_instances'];
        name_list.forEach((l)=>{
          let tmp_instances =[...this.predictions[classifierName][l][confidence].instances]
          tmp_instances.forEach((i)=>{
            all_instances_list.push(i)
            if (l == 'ci_fp_instances' || l == 'ci_tp_instances') {
              instances_list.push(i)
            }
          })
        })
        let instances = new Set(all_instances_list);
        let overlappingInstances = intersection(instances, selection);
        return y(overlappingInstances.size)
      };

      const hasFocusItem = (classifierName:string, confidence: string, selection: Set<string>) => {
        let instances_list = [];
        let all_instances_list = [];
        let name_list = ['ci_fn_instances', 'ci_fp_instances', 'ci_tn_instances', 'ci_tp_instances'];
        name_list.forEach((l)=>{
          let tmp_instances =[...this.predictions[classifierName][l][confidence].instances]
          tmp_instances.forEach((i)=>{
            all_instances_list.push(i)
            if (l == 'ci_fp_instances' || l == 'ci_tp_instances') {
              instances_list.push(i)
            }
          })
        })
        let instances = new Set(all_instances_list);
        let overlappingInstances = intersection(instances, selection);
        for (const id of overlappingInstances) {
          if(this.$store.state.focusItemId === id) return true
        }
        return false
      }

      const selections = [first, second];

      selections.forEach((cur_selection, idx)=>{
        if (!cur_selection) {
          this.svg.selectAll('selection-rect-'+idx).attr('height', '0');
          this.svg.selectAll('selection-circle-'+idx).attr("visibility","hidden");
        } else {
          this.confidence.forEach((c)=>{
            confidenceClassifierDict[c].forEach((d)=>{
              let selection_attributes = {
                  barCells : this.svg,
                  x : xAxis(c) + x(d['classifier']) + (idx+1) * barWidth / 4 ,
                  y : this.height * 0.4  - selectionHeight(d['classifier'], d['confidence'], cur_selection.instances),
                  width : barWidth / 4,
                  height : selectionHeight(d['classifier'], d['confidence'], cur_selection.instances),
                  r  : barWidth / 8,
                  color : idx == 0? this.selection1Color : this.selection2Color,
                  circle_visibility : selectionHeight(d['classifier'], d['confidence'], cur_selection.instances) > 0 && selectionHeight(d['classifier'], d['confidence'], cur_selection.instances) < this.height * 0.01?  "visible" :"hidden",
                  cx : xAxis(c) + x(d['classifier']) + barWidth / 2  + (idx - 1/2) * barWidth / 4,
                  cy :  this.height * 0.4  - barWidth / 8,
                  selection_type: idx,
                  focused: hasFocusItem(d['classifier'], d['confidence'], cur_selection.instances),
                  view_name : this.name
                }
                this.$store.dispatch('drawSelections',selection_attributes)
            })
          })
        }
      })

    },
    select(
      classifier: string,
      whichOverlap: 'first' | 'second',
      interval:string,
    ) {
      d3.event.preventDefault();
      d3.event.stopPropagation();

      const constraint = blankConstraint();
      constraint.rule = Rule.RIGHT;
      constraint.classifier = classifier;

      let tmp_instances = []
      let instances_types = ['ci_tp_instances', 'ci_tn_instances', 'ci_fp_instances', 'ci_fn_instances']
      instances_types.forEach((type) =>{
        let interval_instances = [...this.predictions[classifier][type][interval].instances]
        interval_instances.forEach((i)=>{
          tmp_instances.push(i)
        })
      })
      const instances = new Set(tmp_instances)

      const description = `Instances which ${classifier} in interval ${interval}`;
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
  },
});
</script>

<style scoped>
.line {
    fill: none;
    stroke: #ffab00;
    stroke-width: 3;
}

/* Style the dots by assigning a fill and stroke */
.dot {
    fill: #ffab00;
    stroke: #fff;
}
.card {
  background-color: white;
}
.area {
  fill: rgba(0,128,255,0.2);
}
/* rect {
	fill: teal;
} */
.dropdown .option {
  display:none;
}
.dropdown rect{
  stroke-width:0.5;
  stroke:rgb(0,0,0)
}
.dropdown:hover .option {
  display:unset;
}
.dropdown {
  cursor:pointer;
}
  
</style>
