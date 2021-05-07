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
            <span>Uncertainty Heatmap </span>
          </div>
        </v-expansion-panel-header>
        <v-expansion-panel-content>
            <div style="margin: 0px 30px;">
              <v-radio-group v-model="correlationMode" label="calculation criteria">
                <v-radio label="accuracy + (consider uncertainty as right)" value="acc1"></v-radio>
                <v-radio label="accuracy (consider uncertainty as uncertain)" value="acc2"></v-radio>
                <v-radio label="accuracy - (consider uncertainty as wrong)" value="acc3"></v-radio>
                <v-radio label="precision - (consider uncertainty as uncertain)" value="precision"></v-radio>
                <v-radio label="recall - (consider uncertainty as uncertain)" value="recall"></v-radio>
                <v-radio label="f1 - (consider uncertainty as uncertain)" value="f1"></v-radio>
                <v-radio label="mcc - (consider uncertainty as uncertain)" value="mcc"></v-radio>
              </v-radio-group>
            </div>
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
  <multiselect v-model="value" :options="options" 
      :multiple="true" 
      :close-on-select="false" 
      :clear-on-select="false" 
      :preserve-search="true" 
      placeholder="Pick sets" label="name" track-by="name" 
      :preselect-first="true">
      <template slot="selection" slot-scope="{ values, search, isOpen }">
        <span class="multiselect__single" v-if="values.length &amp;&amp; !isOpen">
          {{ values.length }} 
          options selected
        </span>
      </template>
    </multiselect>
  <div id="legend1" ></div>
  <div ref="svg" /></div> 
    
</template>

<script src="https://cdnjs.cloudflare.com/ajax/libs/chroma-js/1.3.5/chroma.min.js"></script>

<script lang="ts">
import Vue from 'vue';
import * as d3 from 'd3';
import legend from 'd3-svg-legend'
import { legendColor } from 'd3-svg-legend'

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

interface MetricsWithClassifier {
  classifier: string;
  metrics: Metrics;
}


export default Vue.extend({
  name: 'UncertaintyHeatMap',
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
    const correlationMode = 'acc2' as 'acc1'| 'acc2' | 'acc3' |'precision'| 'recall'| 'f1' | 'mcc' | 'uncertain';
    return {
      min:0,
      max:100,
      correlationMode,
      value: [],
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
    };
  },
  computed: {
    selectionHistory(): SelectionRecord[] {
      return this.$store.state.selectionHistory;
    },
    options(): any[] {
      let options = []
      const classifiers = this.classifiers
      classifiers.forEach((c)=>{
        options.push({name: c});
      })
      return options
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
    confidenceRange(): string[] {
      return ["0","0.05", "0.1","0.15", "0.2", "0.25", "0.3","0.35", "0.4", "0.45", "0.5", "0.55", "0.6", "0.65", "0.7","0.75", "0.8","0.85", "0.9","0.95","1.0"]

    },
    classifierThresholds():{} {
      return this.$store.state.classifierThresholdDict;
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
      let features = []
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
      
      let correlations = []
      let selectedClassifiers = this.value.map((v)=>v.name)
      let cur_classifier = selectedClassifiers[0] 
      this.confidenceRange.forEach((group)=>{
        this.confidenceRange.forEach((variable)=>{
          let cur_threshold = Object.keys( this.classifierThresholds).includes(cur_classifier)? this.classifierThresholds[cur_classifier] / 100 : 0.5
          let left_edge = parseFloat(group);
          let right_edge = parseFloat(variable);
          let c = cur_classifier
          let predictions = {c:{}}
          predictions[c] ={
              'tp':0,
              'tn':0,
              'fp':0,
              'fn':0,
              'm_tp':0,
              'm_tn':0,
              'm_fp':0,
              'm_fn':0,
            }
          if (left_edge <= right_edge) {
              if (left_edge == right_edge){
                cur_threshold = group
              }
              this.instances.forEach((id)=>{
              let continuous_value = (instanceById(id).continuous_predictions[c])
              // let correct = instanceById(id).actual == instanceById(id).predictions[c]? 1 : 0;
              if (continuous_value > left_edge && continuous_value < right_edge) {
                  if (instanceById(id).actual == this.classes[1]) {
                    if (continuous_value >= cur_threshold) {
                      predictions[c]['m_tp'] += 1
                    } else {
                      predictions[c]['m_fn'] += 1
                    }
                  } else {
                    if (continuous_value < cur_threshold) {
                      predictions[c]['m_tn'] += 1
                    } else {
                      predictions[c]['m_fp'] += 1
                    }
                  }
              } else if (continuous_value >= right_edge){
                if (instanceById(id).actual == this.classes[1]){
                  predictions[c]["tp"] += 1
                } else {
                  predictions[c]["fp"] += 1
                }
              } else{
                if (instanceById(id).actual == this.classes[0]) {
                  predictions[c]["tn"] += 1
                } else {
                  predictions[c]["fn"] += 1
                }
              }
                
            })
          }
          
          let uncertain_size = predictions[c].m_tp +  predictions[c].m_tn +  predictions[c].m_fp +  predictions[c].m_fn;
          let acc1 = (predictions[c].tp + predictions[c].tn + uncertain_size) / this.instances.length;
          let acc2 = (predictions[c].tp + predictions[c].tn + predictions[c].m_tp +  predictions[c].m_tn) / this.instances.length;
          let acc3 = (predictions[c].tp + predictions[c].tn) / this.instances.length;
          let precision = (predictions[c].tp + predictions[c].fp)==0?0:(predictions[c].tp) / (predictions[c].tp + predictions[c].fp);
          let recall = (predictions[c].tp + predictions[c].fn)==0?0:(predictions[c].tp) / (predictions[c].tp + predictions[c].fn);
          let f1  = (precision + recall) == 0 ? 0 : 2 * precision * recall / (precision + recall);
          let tp = predictions[c].tp; 
          let fp =  predictions[c].fp;
          let tn =  predictions[c].tn;
          let fn =  predictions[c].fn
          let mcc = 0
          if ((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn) != 0) {
            mcc = ((tp*tn-fp*fn) / Math.sqrt((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn)))
          } else {
            mcc = 0
          } 
          correlations.push({
            'group':group,
            'variable': variable,
            'value':acc2 * 100,
            'acc1':acc1 * 100,
            'acc3':acc3 * 100,
            'precision':precision * 100,
            'recall':recall * 100,
            'f1': f1 * 100,
            'mcc': mcc * 100, 
            'uncertainty':uncertain_size / this.instances.length * 100
          })
        })
      })
      return correlations;
    },
    selections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    saveStatus() {
      return this.$store.state.saveStatus;
    },
    resumeStatus() {
      return this.$store.state.resumeStatus
    },
  },
  watch: {
    resumeStatus() {
      let viewsConfig = this.$store.state.viewsConfig;
      viewsConfig.forEach((view)=>{
        if (view.name == 'UncertaintyHeatMap') {
          if (view.config) {
            let value  = view.config;
            this.value = []
            value.classifiers.forEach((c)=>{
              if (this.classifiers.includes(c)) {
                this.value.push({'name':c})
              }
            })
            this.correlationMode = value.correlationMode
          }
        }
      })
      this.drawInitial();
    },
    saveStatus() {
      let config = {"name":"UncertaintyHeatMap", 
                    "config": {
                      "classifiers":this.value.map((c)=>c.name),
                      "correlationMode":this.correlationMode}}
      this.$store.dispatch("changedSaveConfig",config)
    },
    value() {
      if (this.value.length > 1) {
        this.value = [this.value[this.value.length-1]]
      }
      this.updateCorrelations();
      this.drawCorrelation();
    },
    instances() {
      this.updateCorrelations();
      this.drawCorrelation();
    },
    correlationMode() {
      this.drawCorrelation();
    },
  },
  mounted() {
    let viewsConfig = this.$store.state.viewsConfig;
    viewsConfig.forEach((view)=>{
      if (view.name == 'UncertaintyHeatMap') {
        if (view.config) {
          let value  = view.config;
          this.value = []
          value.classifiers.forEach((c)=>{
            if (this.classifiers.includes(c)) {
              this.value.push({'name':c})
            }
          })
          this.correlationMode = value.correlationMode
        }
      }
    })
    this.drawInitial();
  },
  methods: {
    updateCorrelations() {
     
      let correlations = []
      let selectedClassifiers = this.value.map((v)=>v.name)
      let cur_classifier = selectedClassifiers[0]
      this.confidenceRange.forEach((group)=>{
        this.confidenceRange.forEach((variable)=>{
          let cur_threshold = Object.keys( this.classifierThresholds).includes(cur_classifier)? this.classifierThresholds[cur_classifier] / 100 : 0.5
          let left_edge = parseFloat(group);
          let right_edge = parseFloat(variable);
          let c = cur_classifier
          let predictions = {c:{}}
          predictions[c] ={
              'tp':0,
              'tn':0,
              'fp':0,
              'fn':0,
              'm_tp':0,
              'm_tn':0,
              'm_fp':0,
              'm_fn':0,
            }
          if (left_edge <= right_edge) {
              this.instances.forEach((id)=>{
              let continuous_value = (instanceById(id).continuous_predictions[c])
              let correct = instanceById(id).actual == instanceById(id).predictions[c]? 1 : 0;
              if (continuous_value > left_edge && continuous_value < right_edge) {
                  if (instanceById(id).actual == this.classes[1]) {
                    if (continuous_value >= cur_threshold) {
                      predictions[c]['m_tp'] += 1
                    } else {
                      predictions[c]['m_fn'] += 1
                    }
                  } else {
                    if (continuous_value < cur_threshold) {
                      predictions[c]['m_tn'] += 1
                    } else {
                      predictions[c]['m_fp'] += 1
                    }
                  }
              } else if (continuous_value >= right_edge){
                if (instanceById(id).actual == this.classes[1]){
                  predictions[c]["tp"] += 1
                } else {
                  predictions[c]["fp"] += 1
                }
              } else{
                if (instanceById(id).actual == this.classes[0]) {
                  predictions[c]["tn"] += 1
                } else {
                  predictions[c]["fn"] += 1
                }
              }
                
            })
          }
          let uncertain_size = predictions[c].m_tp +  predictions[c].m_tn +  predictions[c].m_fp +  predictions[c].m_fn
          let acc1 = (predictions[c].tp + predictions[c].tn + uncertain_size) / this.instances.length;
          let acc2 = uncertain_size ==  this.instances.length? 0 : (predictions[c].tp + predictions[c].tn) / (this.instances.length - uncertain_size);
          let acc3 = (predictions[c].tp + predictions[c].tn) / this.instances.length;
          let precision = predictions[c].tp + predictions[c].fp == 0? 0: (predictions[c].tp) / (predictions[c].tp + predictions[c].fp)
          let recall = (predictions[c].tp + predictions[c].fn) == 0? 0: (predictions[c].tp) / (predictions[c].tp + predictions[c].fn)
          let f1  = (precision + recall) == 0 ? 0 : 2 * precision * recall / (precision + recall);
          let tp = predictions[c].tp; 
          let fp =  predictions[c].fp;
          let tn =  predictions[c].tn;
          let fn =  predictions[c].fn
          let mcc = 0
          if ((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn) != 0) {
            mcc = ((tp*tn-fp*fn) / Math.sqrt((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn)))
          } else {
            mcc = 0
          } 
          correlations.push({
            'group':group,
            'variable': variable,
            'value':acc2 * 100,
            'acc1':acc1 * 100,
            'acc3':acc3 * 100,
            'precision':precision * 100,
            'recall':recall * 100,
            'f1': f1 * 100,
            'mcc': mcc * 100, 
            'uncertainty':uncertain_size / this.instances.length * 100
          })
        })
      })
      this.correlations = correlations;
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
      const svg = svgAll.append('g')
          .attr("class","svg-button")
          .attr('transform', `translate(${0}, ${this.margin.top})`);
      
      const svg_correlations = svgAll.append('g')
          .attr("class","svg-correlations")
          .attr('transform',`translate(${0}, ${this.margin.top*1.2 + this.margin.left })`)     ;
      const drawTitels = () =>{
        svgAll.append('text')
          .attr('transform', () => {
            const xOffset = this.width * 0.5;
            const yOffset = this.height + this.margin.bottom * 2.5;
            return `translate(${xOffset}, ${yOffset})`;
          })
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text('Lowerbound Threshold');

        svgAll.append('text')
          .attr('transform',  () => {
            const xOffset = this.margin.left / 4;
            const yOffset = this.height * 0.6;
            return `translate(${xOffset}, ${yOffset}),`+`rotate(-90)`;
          })
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text('Upperbound threshold');

        svgAll.append('text')
          .attr('class', 'view-title')
          .attr('transform', () => {
            const xOffset = this.width * 0.5;
            const yOffset = this.margin.top * 2;
            return `translate(${xOffset}, ${yOffset})`;
          })
          .style('text-anchor', 'middle')
          .style('font-size', '30px')
          .text(this.correlationMode == 'acc2'? 'Accuracy'
              : this.correlationMode == 'acc1'? 'Accuracy +'
              : this.correlationMode == 'acc3'? 'Accuracy -'
              : this.correlationMode == 'precision'? 'Precision'
              : this.correlationMode == 'recall'? 'Recall'
              : this.correlationMode == 'f1'? 'F1'
              : this.correlationMode == 'mcc'? 'MCC'
              : 'Uncertainty');

      }

      let ndots = 10
      let midpoint = .5;  
      let dimgrey = "#CCC";
      let upinterp = d3.interpolatePlasma;
      let midcolor = upinterp(0);
      let lowinterp = d3.interpolateRgb(dimgrey,midcolor);

      function cinterp(v) {
          if (v<=midpoint) {
              return lowinterp(v/midpoint);
          } else {
              return upinterp( (v-midpoint)/(1-midpoint));
          }
      }

      for (let y=0; y<ndots+1; y++) {
          let yv = y/ndots;

          let upinterp = d3.interpolatePlasma;
          let midcolor = upinterp(0);
          let lowinterp = d3.interpolateRgb(dimgrey,midcolor);

          function cinterp(v) {
              if (v<=midpoint) {
                  return lowinterp(v/midpoint);
              } else {
                  return upinterp( (v-midpoint)/(1-midpoint));
              }
          }

          svg.append("rect")
              .attr("x",y*20)
              .attr("y",0)
              .attr("width",20)
              .attr('height',10)
              .style("fill",cinterp(yv))
      }
      const drawLengends = () =>{
        svg.append("circle")
          .attr('r',12)
          .attr("cx",12)
          .attr("cy",36)
          .attr('fill', 'purple')
        svg.append("text")
          .attr("x",30)
          .attr("y",42)
          .text('# non-rejected')
          .attr('font-size',18)

      };
      drawTitels();
      drawLengends();
      this.drawCorrelation();      
    },
    drawCorrelation() {
      if (this.correlations.length == 0) {
        this.correlations = this.InitialCorrelations
      }

      const chart = d3.select(this.$refs.svg);
      const svg = chart.select(".svg-correlations")
      const svg_legend = chart.select(".svg-button")
      const correlationMode = this.correlationMode;
      const viewTitile = chart.select('.view-title')
      
      viewTitile.text(this.correlationMode == 'acc2'? 'Accuracy'
              : this.correlationMode == 'acc1'? 'Accuracy +'
              : this.correlationMode == 'acc3'? 'Accuracy -'
              : this.correlationMode == 'precision'? 'Precision'
              : this.correlationMode == 'recall'? 'Recall'
              : this.correlationMode == 'f1'? 'F1'
              : this.correlationMode == 'mcc'? 'MCC'
              : 'Uncertainty');

      svg.selectAll('*').remove();  
      
      const drawCorrelation = () =>{
        // Labels of row and columns
        var myGroups = []
        var myVars = []

        this.correlations.forEach((corr)=>{
          if (!myGroups.includes(corr.group)) {
            myGroups.push(corr.group)
          }
          if (!myVars.includes(corr.variable)){
            myVars.push(corr.variable)
          }
        })

        // Build X scales and axis:
        var x = d3.scaleBand()
          .range([ 0, this.width ])
          .domain(myGroups)
          .padding(0.01);
        const xAxis = (g: any) => g
          .attr('transform', `translate(${this.margin.left }, ${this.height})`)
          .call(
            d3.axisBottom(x)
              .tickSizeOuter(0),
          );
        svg.append('g')
          .call(xAxis)
          .attr('font-size', 20)
          .selectAll('text')
          .attr('transform', 'rotate(30)')
          .attr('text-anchor', 'start');

        // Build X scales and axis:
        var y = d3.scaleBand()
          .range([ this.height, 0 ])
          .domain(myVars)
          .padding(0.01);
        const yAxis = (g: any) => g
          .attr('transform', `translate(${this.margin.left}, ${0})`)
          .call(d3.axisLeft(y)
            .tickSizeOuter(0),
          );

        svg.append('g')
          .call(yAxis)
          .attr('font-size', 20)
          .selectAll('text')
          .attr('text-anchor', 'end');  

        var data  = this.correlations;
                 
        //Read the data

          // create a tooltip
          var tooltip = svg.append("rect")
            .attr("width",this.width)
            .attr("height",this.margin.left / 4 * 5 -10 )
            .attr("x",this.margin.left)
            .attr("y",-this.margin.left-20)
            .attr("rx",5)
            .attr("fill", "white")
            .attr("stroke","grey")
            .attr("stroke-width",2)
            .style("opacity", 0)
            
          var tooltiptext1 = svg.append("text")
            .attr("x",this.margin.left + 2)
            .attr("y",(-this.margin.left-60)/2)
            .attr("dy","-0.5em")
            .attr("font-size",32)
          var tooltiptext2 = svg.append("text")
            .attr("x",this.margin.left + 2)
            .attr("y",(-this.margin.left-60)/2)
            .attr("dy","0.5em")  
            .attr("font-size",32)
          var tooltiptext3 = svg.append("text")
            .attr("x",this.margin.left + 2)
            .attr("y",(-this.margin.left-60)/2)
            .attr("dy","1.5em")  
            .attr("font-size",32)
          var tooltiptext4 = svg.append("text")
            .attr("x",this.margin.left + 2)
            .attr("y",(-this.margin.left-60)/2)
            .attr("dy","2.5em")  
            .attr("font-size",32)
          // Three function that change the tooltip when user hover / move / leave a cell
          var mouseover = function(d) {
            tooltip.style("opacity", 1)
          }
          var mousemove = function(d) {
            viewTitile.attr('visibility','hidden')
            tooltiptext1.style("opacity", 1)
            tooltiptext2.style("opacity", 1)  
            tooltiptext3.style("opacity", 1) 
            tooltiptext4.style("opacity", 1) 
            tooltiptext1
              .text('Uncertain Range: '+ d.group + " - " + d.variable )
            tooltiptext2
              .text('accuracy+ :' + parseFloat(d.acc1).toFixed(3) + '    ' +      'accuracy :' + parseFloat(d.value).toFixed(3) + '    '  + 'accuracy- :' + parseFloat(d.acc3).toFixed(3))
            tooltiptext3
              .text('precision :' + parseFloat(d.precision).toFixed(3) + '    ' + 'recall   :' + parseFloat(d.recall).toFixed(3) + '    ' + 'f1 :' + parseFloat(d.f1).toFixed(3))
            tooltiptext4
              .text('mcc :' + parseFloat(d.mcc).toFixed(3) + '    ' + 'uncertain :' + parseFloat(d.uncertainty).toFixed(3))
          }
          var mouseleave = function(d) {
            tooltip.style("opacity", 0)
            tooltiptext1.style("opacity", 0)
            tooltiptext2.style("opacity", 0)
            tooltiptext3.style("opacity", 0)
            tooltiptext4.style("opacity", 0)
            viewTitile.attr('visibility','visible')
          }

          // add the squares
          let midpoint = .5;  
          let dimgrey = "#CCC";
          let upinterp = d3.interpolatePlasma;
            let midcolor = upinterp(0);
            let lowinterp = d3.interpolateRgb(dimgrey,midcolor);

            function cinterp(v) {
                if (v<=midpoint) {
                    return lowinterp(v/midpoint);
                } else {
                    return upinterp( (v-midpoint)/(1-midpoint));
                }
            }

          svg.selectAll()
            .data(data, function(d) {return d["group"]+':'+d["variable"];})
            .enter()
              .append("circle")
                .attr("cx",function(d) { return y.bandwidth() /1.5+x(d["group"]) })
                .attr("cy",function(d) { return y.bandwidth() /3+y(d["variable"]) })
                .attr("r",(d)=>(100-parseFloat (d["uncertainty"])) / 100 * y.bandwidth() / 2)
              .attr("transform", "translate(" + this.margin.left + "," + 0 + ")")
      
              .style("fill", d=>{ 
                if (parseFloat (d["value"])  >= 0) 
                  return this.correlationMode == 'acc2'? cinterp(parseFloat (d["value"]) / 100 )
                        : this.correlationMode == 'acc1'? cinterp(parseFloat (d["acc1"]) / 100 )
                        : this.correlationMode == 'acc3'? cinterp(parseFloat (d["acc3"]) / 100)
                        : this.correlationMode == 'precision'? cinterp(parseFloat (d["precision"]) / 100)
                        : this.correlationMode == 'recall'? cinterp(parseFloat (d["recall"]) / 100)
                        : this.correlationMode == 'f1'? cinterp(parseFloat (d["f1"]) / 100)
                        : this.correlationMode == 'mcc'? cinterp(Math.abs(parseFloat (d["mcc"])) / 100)
                        : cinterp(parseFloat (d["uncertainty"]) / 100 )
                else 
                  return cinterp(-parseFloat (d["value"]) * 100)
                  })
            .attr("visibility",d=>d['group'] > d['variable']? "hidden":"visible")
            .on("mouseover", mouseover)
            .on("mousemove", mousemove)
            .on("mouseleave", mouseleave)
        
      } ;

      
      drawCorrelation();   
    },
  },
});
</script>


<style scoped>
.card {
  background-color: white;
}
</style>
