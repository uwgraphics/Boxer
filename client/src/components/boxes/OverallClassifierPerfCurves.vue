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
            <span>Performance Curves</span>
          </div>
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <div style="margin: 0px 30px;">
              <v-radio-group v-model="evaluationKeys" label="Evaluation method">
                <v-radio label="ROC" value="roc"></v-radio>
                <v-radio label="PR" value="pr"></v-radio>
              </v-radio-group>
            </div>
            <div style="margin: 0px 30px;">
            <v-radio-group v-model="selection_mode" label="Selection Mode">
              <v-radio label="overall curve " value="overall"></v-radio>
              <v-radio label="selection curve" value="selected"></v-radio>
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
    <div id="legend1" >
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

interface MetricsWithClassifier {
  classifier: string;
  metrics: Metrics;
}

export default Vue.extend({
  name: 'Performance_Curves',
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
    const evaluationKeys = 'roc' as 'roc'| 'pr';
    const hover = {
      classifier: '',
      threshold: '',
    };
    const pointSelection = {
      classifier:'',
      threshold:''
    }
    const pointRemove = {
      classifier:'',
      threshold:''
    };
    const selection_mode = 'overall' as 'overall' | 'selected'

    return {
      value: [],
      thresholdToidx: {},
      selectedCurves:[],
      selection_mode,
      pointRemove,
      pointSelection,
      hover,
      evaluationKeys,
      height,
      margin,
      curclick:[],
      panel: [],
      rightColor: '#d1e5f0',
      rightHoverColor: '#4393c3',
      width,
      selectedEval:'',
      wrongColor: '#fddbc7',
      wrongHoverColor: '#d6604d',
    };
  },
  computed: {
    addedThresholdClassifiers(): [] {
      if (this.$store.state.datasetType != "continuous") {
        return []
      }
      return this.$store.state.addedThresholdClassifiers;
    },
    classes(): string[] {
      return [...this.boxProps.classes];
    },
    thresholdClassifierNameList():string[] {
      return this.$store.state.thresholdClassifierNameList
    },
    classifierThresholds():{} {
      let classifierThresholds = {}
      this.thresholdClassifierNameList.forEach((c)=>{
        let classifier = c.split("_")[0]
        let threshold = (parseInt(c.split("_")[1]) / 100).toFixed(2)
        classifierThresholds[classifier] = threshold
      })
      return classifierThresholds;
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
    options(): any[] {
      let options = []
      const classifiers = this.classifiers
      classifiers.forEach((c)=>{
        options.push({name: c});
      })
      return options
    },
    features(): string[] {
      return [...this.boxProps.features];
    },
    instances(): string[] {
      return [...this.boxProps.instances];
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
    min_y():{} {
      return {"roc":1, "pr":1};
    },
    predictions(): {
      [classifier: string]: {
        x_roc: Number[],
        y_roc: Number[],
        value_roc: Number[],
        x_pr: Number[],
        y_pr: Number[],
        line_roc: string,
        line_pr: string
      },
    }{
      const predictions: {
        [classifier: string]: {
          x_roc: Number[],
          y_roc: Number[],
          value_roc: Number[],
          x_pr: Number[],
          y_pr: Number[],
          line_roc: string,
          line_pr: string
        },
      } = this.$store.getters.continuous_metrics;
      return predictions;
    },
    x(): d3.ScaleLinear<number, number> {
      const x = d3.scaleLinear()
        .domain([0, 1])
        .range([0, this.width])
      return x;
    },
    y(): d3.ScaleLinear<number, number> {
      const y = d3.scaleLinear()
        .domain([0, 1])
        .range([this.height, 0]);
      return y;
    },
    outSelections(): {
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
        if (view.name == 'Performance_Curves') {
          if (view.config) {
            let value  = view.config;
            this.value = []
            value.classifiers.forEach((c)=>{
              if (this.classifiers.includes(c)) {
                this.value.push({'name':c})
              }
            })
            this.evaluationKeys = value.evaluation;
            this.selection_mode = value.selection
          }
        }
      })
      this.drawInitial();
    },
    saveStatus() {
      let config = {"name":"Performance_Curves", 
                    "config": {
                      "classifiers":  this.value.map((c)=>c.name),
                      "evaluation": this.evaluationKeys,
                      "selection": this.selection_mode}}
      this.$store.dispatch("changedSaveConfig",config)
    },
    value() {
      this.drawInitial();
    },
    addedThresholdClassifiers() {
      this.drawAddedPoint();
      this.drawCurrentThreshold();
    },
    thresholdClassifierNameList() {
      this.drawAddedPoint();
      this.drawCurrentThreshold();
    },
    classifiers() {
      this.drawInitial();
    },
    outSelections() {
      this.drawInitial();
    },
    selection_mode() {
      this.drawInitial();
    },
    pointRemove() {
      this.clearPointSelection();
    },
    pointSelection() {
      this.drawAddedPoint();
      this.drawPointSelection();
    },
    hover() {
      this.drawHover();
    },
    evaluationKeys() {
      this.clearHover();
      this.drawInitial();
    }, 
  },
  mounted() {
    let viewsConfig = this.$store.state.viewsConfig;
    viewsConfig.forEach((view)=>{
      if (view.name == 'Performance_Curves') {
        if (view.config) {
          let value  = view.config;
          this.value = []
          value.classifiers.forEach((c)=>{
            if (this.classifiers.includes(c)) {
              this.value.push({'name':c})
            }
          })
          this.evaluationKeys = value.evaluation;
          this.selection_mode = value.selection
        }
      }
    })
    this.drawInitial();
  },
  methods: { 
    clearHover() {
      this.hover = ({ classifier: '', threshold: ''});
    },
    clearPointSelection() {
      const chart = d3.select(this.$refs.svg);
      const classifier = this.pointSelection.classifier;
      const threshold = this.pointSelection.threshold;

      chart.select(".dot_"+classifier).attr("r",5).attr("opacity",0)
      chart.select(".pointText_"+classifier).attr("visibility","hidden")
    },
    drawAddedPoint() {
      const chart = d3.select(this.$refs.svg);
      for (let classifier in this.classifierThresholds) {
        for (let threshold in this.thresholdToidx[classifier]) {
          let idx = this.thresholdToidx[classifier][threshold]
          chart.select(".dot_"+classifier + "_" + idx).attr("r",5).attr("opacity",0)
          chart.select(".pointText_"+classifier + "_" + idx).attr("visibility","hidden")
        }
      }
      this.addedThresholdClassifiers.forEach((classifier) =>{
        let c = classifier.substring(4,classifier.length-5)
        let threshold = parseFloat(classifier.substring(classifier.length-4,classifier.legend))
        let selectedDot = c + "_" + this.thresholdToidx[c][threshold]
        chart.select(".dot_"+selectedDot).attr("r",8).attr("opacity",1)
        chart.select(".pointText_"+selectedDot).attr("visibility","visible")
      })
    },
    drawPointSelection() {
      const chart = d3.select(this.$refs.svg);
      const classifier = this.pointSelection.classifier;
      const threshold = this.pointSelection.threshold;

      chart.select(".dot_"+classifier).attr("r",8).attr("opacity",1)
      chart.select(".pointText_"+classifier).attr("visibility","visible")
      this.updateThreshold();
    },
    drawCurrentThreshold() {
      const chart = d3.select(this.$refs.svg);
      const chosenClassifiers = this.value.map((c)=>c.name)
      
      for (let classifier in this.classifierThresholds) {
        if (chosenClassifiers.includes(classifier)) {
          let threshold = this.classifierThresholds[classifier]
          let idx = this.thresholdToidx[classifier][threshold]
          chart.select(".dot_"+classifier + "_" + idx).attr("r",8).attr("opacity",1)
          chart.select(".pointText_"+classifier + "_" + idx).attr("visibility","visible")
        }
      }
    },
    updateThreshold() {
      const classifier = this.pointSelection.classifier.split("_")[0];
      const value = parseFloat(this.pointSelection.threshold).toFixed(2);
      let changedClassifier = {"classifier":classifier, "single_threshold": parseFloat(value) * 100};
      this.$store.dispatch("changedCurveChosenClassifierThresholdTuple",changedClassifier)
     },
    drawHover() {
      const chart = d3.select(this.$refs.svg);
      const evaluationKeys = this.evaluationKeys;
      const name = this.hover.classifier;
      const i = this.hover.threshold;
      const classifiers = this.value.map((c)=>c.name)

      if (this.selection_mode == 'overall') {
        if (name != ''){  
          chart.select(".hoverBox").attr("hidden")
          if (evaluationKeys == "roc"){
            chart.select(".auc_value_"+name).attr("visibility","visible")

          }
          chart.select(".legend_circle_"+name).attr("r",8)
          chart.select(".legend_text_"+name).style("font-size", "20px")
          classifiers.forEach((c)=>{
            if (c!= name) {
              chart.select(".line_"+c).style("opacity",0.3)
            }
          })
          if (i != '') {
            chart.select(".text_"+name+"_"+i).attr("visibility","visible")
            chart.select(".tpr_"+name+"_"+i).attr("visibility","visible")
            chart.select(".fpr_"+name+"_"+i).attr("visibility","visible")
            chart.select(".acc_"+name+"_"+i).attr("visibility","visible")
            chart.select(".hoverBox").attr("visibility","visible")
          } 
        } else {
          classifiers.forEach((c)=>{
            chart.select(".text_"+c+"_"+i).attr("visibility","hidden")
            chart.select(".fpr_"+c+"_"+i).attr("visibility","hidden")
            chart.select(".tpr_"+c+"_"+i).attr("visibility","hidden")
            chart.select(".acc_"+c+"_"+i).attr("visibility","hidden")
            chart.select(".hoverBox").attr("visibility","hidden")
            chart.select(".legend_circle_"+c).attr("r",6)
            chart.select(".legend_text_"+c).style("font-size", "15px")
            chart.select(".line_"+c).style("opacity",1)
            chart.select(".auc_value_"+c).attr("visibility","hidden")
          })
        }
      } else {
        let count = 0
        this.selectedCurves.forEach((predictions)=>{
          count += 1
          let selected_type = predictions.name
          if (name != ''){  
            chart.select(".hoverBox").attr("hidden")
            if (evaluationKeys == "roc"){
              chart.select(".auc_value_"+name + "_" + selected_type).attr("visibility","visible").attr("y",100 + 40 * count)
            }
            chart.select(".legend_circle_"+name).attr("r",8)
            chart.select(".legend_text_"+name).style("font-size", "20px")
            classifiers.forEach((c)=>{
              if (c!= name) {
                chart.select(".line_"+c + "_" + selected_type).style("opacity",0.3)
              }
            })
            if (i != '') {
              chart.select(".text_"+name+"_"+i).attr("visibility","visible")
              chart.select(".tpr_"+name+"_"+i).attr("visibility","visible")
              chart.select(".fpr_"+name+"_"+i).attr("visibility","visible")
              chart.select(".acc_"+name+"_"+i).attr("visibility","visible")
              chart.select(".hoverBox").attr("visibility","visible")
            } 
          } else {
            classifiers.forEach((c)=>{
              chart.select(".text_"+c+"_"+i).attr("visibility","hidden")
              chart.select(".fpr_"+c+"_"+i).attr("visibility","hidden")
              chart.select(".tpr_"+c+"_"+i).attr("visibility","hidden")
              chart.select(".acc_"+c+"_"+i).attr("visibility","hidden")
              chart.select(".hoverBox").attr("visibility","hidden")
              chart.select(".legend_circle_"+c).attr("r",6)
              chart.select(".legend_text_"+c).style("font-size", "15px")
              chart.select(".line_"+c + "_" + selected_type).style("opacity",1)
              chart.select(".auc_value_"+c+ "_" + selected_type).attr("visibility","hidden")
            })
          }
        })
      }
    },
    drawInitial() {
      // @ts-ignore
      d3.select(this.$refs.svg).selectAll('*').remove();
      // @ts-ignore
      const sequentialScale = d3.scaleSequential<string>( d3.interpolatePlasma)
            .domain([0, this.classifiers.length])
            .interpolator(function (x) { return d3.interpolatePlasma(.8*x);} );
      const formatDecimal = d3.format(".4f")
      const duration = 250;
      const width = this.width;
      const height = this.height;
      const margin = this.margin;
      const evaluationKeys = this.evaluationKeys;
      const classifiers = this.value.map((c)=>c.name);
      const xValue = d3.scaleLinear()
        .domain([0, 1])
        .range([0, this.width]);
      const yValue = d3.scaleLinear()
        .domain([this.evaluationKeys=="pr" ? 0:0,1])
        .range([this.height, 0]);
      
      const svg = d3.select(this.$refs.svg).append('svg')
        .attr('width', '100%')
        .attr('viewBox', `0 0
          ${this.width + this.margin.left + this.margin.right}
          ${this.height + this.margin.top + this.margin.bottom}`)
        .append('g')
          .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);

      let classifierDict = {}
      let idx = 0;
      classifiers.forEach((c)=>{
        idx += 1
        classifierDict[c] = []
        let count = this.predictions[c].x_roc.length;
        let i = 0;
        this.thresholdToidx[c] = {}
        while (i < count) {
          if (this.evaluationKeys == "roc") {
            let cur_cordinate = {"x": this.predictions[c].x_roc[i], "y":this.predictions[c].y_roc[i], 'acc':this.predictions[c].acc[i], "name":c,"threshold":this.predictions[c].value_roc[i], "color":sequentialScale(idx)}
            classifierDict[c].push(cur_cordinate)
          } else {
            let cur_cordinate = {"x": this.predictions[c].x_pr[i], "y":this.predictions[c].y_pr[i], 'acc':this.predictions[c].acc[i], "name":c,"threshold":this.predictions[c].value_roc[i], "color":sequentialScale(idx)}
            classifierDict[c].push(cur_cordinate)
          }
          this.thresholdToidx[c][parseFloat(this.predictions[c].value_roc[i]).toFixed(2)] =  i 
          i+=1;
        }
      })
      let curveData = []
      let count = 0
      classifiers.forEach((c)=>{
        count += 1;
        let curCurve = {"name":c,"data":classifierDict[c], "color":sequentialScale(count)}
        curveData.push(curCurve)
      })

      const drawInitalCurves = () => {
        var data = classifierDict[classifiers[0]]
        var area_dict = {}

        function path(d) {
          var name = d.name
          area_dict[name] = 0;
          d = d.data
          var path = "M" + " " + xValue(1) + " " + yValue(0)
          var lastx = 1;
          var lasty = 0;
          d.forEach((cordinate)=>{
            path = path + " " + xValue(cordinate.x)
            path = path + " " + yValue(cordinate.y)
            path = path + " " + "L"
            area_dict[name] += ((cordinate.y + lasty) * (lastx- cordinate.x ) / 2)
            lastx = cordinate.x;
            lasty = cordinate.y;
          })
          path += xValue(0) + " " + yValue(0)
          return path
        }


        function line(d) {
          var name = d.name
          area_dict[name] = 0;
          d = d.data
          var path = "M" //+ " " + xValue(1) + " " + yValue(0)
          var lastx = 1;
          var lasty = 0;
          d.forEach((cordinate)=>{
            path = path + " " + xValue(cordinate.x)
            path = path + " " + yValue(cordinate.y)
            path = path + " " + "L"
            area_dict[name] += ((cordinate.y + lasty) * (lastx- cordinate.x ) / 2)
            lastx = cordinate.x;
            lasty = cordinate.y;
          })
          if (evaluationKeys == 'roc')
            path += xValue(0) + " " + yValue(0)
          return path
        }

        // Add the X Axis
        svg.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(xValue));

        // Add the Y Axis
        svg.append("g")
            .call(d3.axisLeft(yValue)); 

        var lines = svg 
          .selectAll("myPath")
          .data(curveData)
          .enter().append("path")
          .attr("d",  line)
          .attr("class",(d,i)=>"line_"+d.name)
          .style("fill", "none")
          .attr("stroke",(d)=>{
            return d.color})
          .style("stroke-width", 3)
          .style("opacity", 1)

        var points = svg.selectAll(".dot")
          .data(curveData)
          .enter()
          .selectAll(".circle")
          .data(function(d: string) { 
            return d["data"]; })
            .enter()
            .append("circle")
          .attr("class",(d,i)=>{
            return "dot_"+d["name"]+"_"+i})  
          .attr("cx", function(d, i) {  
            return xValue(d["x"]) })
          .attr("cy", function(d) { return yValue(d["y"]) })
          .attr("r", (d)=>{
            return 5
          })
          .attr("fill",(d)=>{
            return d['color']})
          .on('mouseenter', (d,i)=>this.hover = ({classifier: d["name"], threshold:i}))
          .on('mouseleave', (d,i)=>this.hover = ({classifier: '', threshold:i}))  
          .on('click', (d,i) => this.pointSelection = ({classifier: d["name"]+"_"+i, threshold:d['threshold']}))
          .on('contextmenu', (d,i) => {
            d3.event.preventDefault();
            this.pointRemove = ({classifier: d["name"]+"_"+i, threshold:d['threshold']})
          })
          .attr("opacity",0);

        var point_texts = svg.selectAll(".pointText")
          .data(curveData)
          .enter()
          // .append("circle")
          .selectAll(".text")
          .data(function(d: string) { 
            return d["data"]; })
            .enter()
            .append("text")
          .attr("class",(d,i)=>{
            return "pointText_"+d["name"]+"_"+i})  
          .attr("x", function(d, i) {  
            return xValue(d["x"]) })
          .attr("y", function(d) { return yValue(d["y"]) })
          .text((d)=>d["threshold"])
          .attr("font-size",16)
          .attr("visibility","hidden")
          .on('contextmenu', (d,i) => {
            d3.event.preventDefault();
            this.pointRemove = ({classifier: d["name"]+"_"+i, threshold:d['threshold']})
          })


          // add hover box
        var hover_box = svg 
          .append("rect")
          .attr("class","hoverBox")
          .attr("width",200)
          .attr("height",200)
          .attr("x", this.evaluationKeys=="roc"? this.width-400: 115)
          .attr("y", this.evaluationKeys=="roc"? 105:205)
          .attr("fill","white")
          .attr("stroke","black")
          .attr("visibility","hidden")
          
        // add threshold value
        var threshold_text = svg.selectAll(".text")
          .data(curveData)
          .enter()
          .selectAll(".text")
          .data(function(d: string) { 
            return d["data"]; })
            .enter()
            .append("text")
          .attr("class",(d,i)=>"text_"+d["name"]+"_"+i)  
          .attr("x", this.evaluationKeys=="roc"? this.width-395:120)
          .attr("y", this.evaluationKeys=="roc"? 160: 245)
          .text(d=>"Threshold: "+formatDecimal(d['threshold']))
          .style("font-size", "25px")
          .attr("alignment-baseline","middle")
          .attr("visibility","hidden")

        var threshold_text_fpr = svg.selectAll(".text")
          .data(curveData)
          .enter()
          .selectAll(".text")
          .data(function(d: string) { 
            return d["data"]; })
            .enter()
            .append("text")
          .attr("class",(d,i)=>"fpr_"+d["name"]+"_"+i)  
          .attr("x", this.evaluationKeys=="roc"? this.width-395:120)
          .attr("y", this.evaluationKeys=="roc"? 200: 285)
          .text(d=>this.evaluationKeys=="roc"? "FPR: "+formatDecimal(d['x']) : "Recall: "+formatDecimal(d['x']))
          .style("font-size", "25px")
          .attr("alignment-baseline","middle")
          .attr("visibility","hidden")
        
        var threshold_text_tpr = svg.selectAll(".text")
          .data(curveData)
          .enter()
          .selectAll(".text")
          .data(function(d: string) { 
            return d["data"]; })
            .enter()
            .append("text")
          .attr("class",(d,i)=>"tpr_"+d["name"]+"_"+i)  
          .attr("x", this.evaluationKeys=="roc"? this.width-395:120)
          .attr("y", this.evaluationKeys=="roc"? 240: 325)
          .text(d=>this.evaluationKeys=="roc"? "TPR: "+formatDecimal(d['y']) : "Precision: "+formatDecimal(d['y']))
          .style("font-size", "25px")
          .attr("alignment-baseline","middle")
          .attr("visibility","hidden")

        var threshold_text_acc = svg.selectAll(".text")
          .data(curveData)
          .enter()
          .selectAll(".text")
          .data(function(d: string) { 
            return d["data"]; })
            .enter()
            .append("text")
          .attr("class",(d,i)=>"acc_"+d["name"]+"_"+i)  
          .attr("x", this.evaluationKeys=="roc"? this.width-395:120)
          .attr("y", this.evaluationKeys=="roc"? 280: 365)
          .text(d=> "Accuracy: "+formatDecimal(d['acc']))
          .style("font-size", "25px")
          .attr("alignment-baseline","middle")
          .attr("visibility","hidden")

      
          // add AUC values
        var AUC_text = svg 
          .selectAll("myText")
          .data(curveData)
          .enter().append("text")
          .attr("class",(d)=>"auc_value_"+d.name)
          .attr("x", this.width-395)
          .attr("y", 130)
          .text(d=>"AUC: "+formatDecimal(area_dict[d.name]))
          .style("font-size", "25px")
          .attr("alignment-baseline","middle")
          .attr("visibility","hidden")
      } ;

      const drawTitles = () => {
        svg.append('text')
          .attr('transform', () => {
            const xOffset = this.width / 2;
            const yOffset = this.height + this.margin.bottom * 0.8;
            return `translate(${xOffset}, ${yOffset})`;
          })
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text(this.evaluationKeys == "roc"? "FPR" : "Recall");
        svg.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('x', -this.height / 2)
          .attr('y', -this.margin.left * 0.9)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text(this.evaluationKeys == "roc"? "TPR" : "Precision");  
      };

      const drawLegend = () => {
        var evaluationKeys = this.evaluationKeys
        var legend_circle = svg 
          .selectAll("myCicle")
          .data(curveData)
          .enter().append("circle")
          .attr("class",(d,i)=>"legend_circle_"+d.name)
          .attr("cx",this.evaluationKeys == "roc"? 10 : this.width-100)
          .attr("cy",(d,i)=>10+i*25)
          .attr("r", 6)
          .style("fill", d=>d.color)
          .on('mouseenter',d=>this.hover = ({classifier:d.name, threshold:''}))
          .on('mouseleave', this.clearHover)  


        var legend_text = svg 
          .selectAll("myText")
          .data(curveData)
          .enter().append("text")
          .attr("class",(d,i)=>"legend_text_"+d.name)
          .attr("x", this.evaluationKeys == "roc"? 30 : this.width-80)
          .attr("y", (d,i)=>10+i*25)
          .text(d=>d.name)
          .style("font-size", "15px")
          .attr("alignment-baseline","middle")
          .on('mouseenter', d=>this.hover = ({classifier:d.name, threshold:''}))
          .on('mouseleave', this.clearHover)  
        
        if (this.selection_mode != 'overall') {
           svg 
            .append("line")
            .attr('y1',  10)
            .attr('x1', 100)
            .attr('x2', 140)
            .attr('y2',  10)
            .attr('stroke', 'blue')
            .attr('stroke-width', '2px')
            .attr('stroke-opacity', 0.5)
            .style("stroke-dasharray",("3, 3"))
          svg 
            .append("text")
            .attr('y',  10)
            .attr('x', 142)
            .style("font-size", "15px")
            .attr("alignment-baseline","middle")
            .text("selection 1")

          svg 
            .append("line")
            .attr('y1', 25 + 10)
            .attr('x1', 100)
            .attr('x2', 140)
            .attr('y2', 25 + 10)
            .attr('stroke', 'blue')
            .attr('stroke-width', '2px')
            .attr('stroke-opacity', 0.5)
          svg 
            .append("text")
            .attr('y', 25 + 10)
            .attr('x', 142)
            .style("font-size", "15px")
            .attr("alignment-baseline","middle")
            .text("selection 2")
        }
      };

      const drawSelectedCurves = () => {
        this.calculatedSelectedCurves();
        // Add the X Axis
        svg.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(xValue));

        // Add the Y Axis
        svg.append("g")
            .call(d3.axisLeft(yValue)); 

        let count = 1;
        this.selectedCurves.forEach((predictions)=>{
          let classifierDict = {}
          let idx = 0;
          let selected_type = predictions.name
          classifiers.forEach((c)=>{
            idx += 1
            classifierDict[c] = []
            let count = predictions[c].x_roc.length;
            let i = 0;
            while (i < count) {
              if (this.evaluationKeys == "roc") {
                let cur_cordinate = {"x": predictions[c].x_roc[i], "y":predictions[c].y_roc[i], "name":c,"threshold":predictions[c].value_roc[i], "color":sequentialScale(idx)}
                classifierDict[c].push(cur_cordinate)
              } else {
                let cur_cordinate = {"x": predictions[c].x_pr[i], "y":predictions[c].y_pr[i],"name":c,"threshold":predictions[c].value_roc[i], "color":sequentialScale(idx)}
                classifierDict[c].push(cur_cordinate)
              }
              i+=1;
            }
          })
          let curveData = []
          let count = 0
          classifiers.forEach((c)=>{
            count += 1;
            let curCurve = {"name":c,"data":classifierDict[c], "color":sequentialScale(count)}
            curveData.push(curCurve)
          })
          
          var data = classifierDict[classifiers[0]]
          var area_dict = {}
          // define the line
          function path(d) {
            var name = d.name
            area_dict[name] = 0;
            d = d.data
            var path = "M" + " " + xValue(1) + " " + yValue(0)
            var lastx = 1;
            var lasty = 0;
            d.forEach((cordinate)=>{
              path = path + " " + xValue(cordinate.x)
              path = path + " " + yValue(cordinate.y)
              path = path + " " + "L"
              area_dict[name] += ((cordinate.y + lasty) * (lastx- cordinate.x ) / 2)
              lastx = cordinate.x;
              lasty = cordinate.y;
            })
            path += xValue(0) + " " + yValue(0)
            return path
          }


          function line(d) {
            var name = d.name
            area_dict[name] = 0;
            d = d.data
            var path = "M" //+ " " + xValue(1) + " " + yValue(0)
            var lastx = 1;
            var lasty = 0;
            d.forEach((cordinate)=>{
              path = path + " " + xValue(cordinate.x)
              path = path + " " + yValue(cordinate.y)
              path = path + " " + "L"
              area_dict[name] += ((cordinate.y + lasty) * (lastx- cordinate.x ) / 2)
              lastx = cordinate.x;
              lasty = cordinate.y;
            })
            if (evaluationKeys == 'roc')
              path += xValue(0) + " " + yValue(0)
            return path
          }

          var lines = svg 
            .selectAll("myPath")
            .data(curveData)
            .enter().append("path")
            .attr("d",  line)
            .attr("class",(d,i)=>"line_"+d.name + "_" + selected_type)
            .style("fill", "none")
            .attr("stroke",(d)=>{
              return d.color})
            .style("stroke-width", 3)
            .style("stroke-dasharray", selected_type == '1'? ("3, 3") : ("0, 0"))
            .style("opacity", 1)

          var points = svg.selectAll(".dot")
            .data(curveData)
            .enter()
            // .append("circle")
            .selectAll(".circle")
            .data(function(d: string) { 
              return d["data"]; })
              .enter()
              .append("circle")
            .attr("class",(d,i)=>{
              return "dot_"+d["name"]+"_"+i })  
            .attr("cx", function(d, i) {  
              return xValue(d["x"]) })
            .attr("cy", function(d) { return yValue(d["y"]) })
            .attr("r", 5)
            .attr("fill",(d)=>{
              return d['color']})
            .on('mouseenter', (d,i)=>this.hover = ({classifier: d["name"], threshold:i}))
            .on('mouseleave', (d,i)=>this.hover = ({classifier: '', threshold:i}))  
            .on('click', (d,i) => this.pointSelection = ({classifier: d["name"]+"_"+i, threshold:d['threshold']}))
            .on('contextmenu', (d,i) => {
              d3.event.preventDefault();
              this.pointRemove = ({classifier: d["name"]+"_"+i, threshold:d['threshold']})
            })
            .attr("opacity",0);

          var point_texts = svg.selectAll(".pointText")
            .data(curveData)
            .enter()
            .selectAll(".text")
            .data(function(d: string) { 
              return d["data"]; })
              .enter()
              .append("text")
            .attr("class",(d,i)=>{
              return "pointText_"+d["name"]+"_"+i})  
            .attr("x", function(d, i) {  
              return xValue(d["x"]) })
            .attr("y", function(d) { return yValue(d["y"]) })
            .text((d)=>d["threshold"])
            .attr("font-size",16)
            .attr("visibility","hidden")
            .on('contextmenu', (d,i) => {
              d3.event.preventDefault();
              this.pointRemove = ({classifier: d["name"]+"_"+i, threshold:d['threshold']})
            })


            // add hover box
          var hover_box = svg 
            .append("rect")
            .attr("class","hoverBox")
            .attr("width",200)
            .attr("height",80)
            .attr("x", this.evaluationKeys=="roc"? this.width-400: 115)
            .attr("y", this.evaluationKeys=="roc"? 105:205)
            .attr("fill","white")
            .attr("stroke","black")
            .attr("visibility","hidden")
            

          // add threshold value
          var threshold_text = svg.selectAll(".text")
            .data(curveData)
            .enter()
            .selectAll(".text")
            .data(function(d: string) { 
              return d["data"]; })
              .enter()
              .append("text")
            .attr("class",(d,i)=>"text_"+d["name"]+"_"+i)  
            .attr("x", this.evaluationKeys=="roc"? this.width-395:120)
            .attr("y", this.evaluationKeys=="roc"? 160: 245)
            .text(d=>"Threshold: "+formatDecimal(d['threshold']))
            .style("font-size", "25px")
            .attr("alignment-baseline","middle")
            .attr("visibility","hidden")

            // add AUC values
          var AUC_text = svg 
            .selectAll("myText")
            .data(curveData)
            .enter().append("text")
            .attr("class",(d)=>"auc_value_"+d.name + "_" + selected_type)
            .attr("x", this.width-395)
            .attr("y", 130)
            .text(d=>"selected " + selected_type+  " AUC: "+formatDecimal(area_dict[d.name]))
            .style("font-size", "25px")
            .attr("alignment-baseline","middle")
            .attr("visibility","hidden")
          count += 1
        })
          
      };

      drawTitles();
      drawLegend();
      if (this.selection_mode =='overall') {
        drawInitalCurves();
      } else {
        drawSelectedCurves();
      }
      this.drawAddedPoint();
      this.drawCurrentThreshold();
    },

    calculatedSelectedCurves() {
      const classifiers = this.value.map((c)=>c.name);
      const {first, second} = this.outSelections;
      this.selectedCurves = []

      const calculate_value = (classifier:string, selection: Set<string>) => {
        let predictions = {};
        let coordinates = [];
        let classifierValues = {}
        let auc = 0;
        let last_acc = 0;
        let last_change_index = 0;
        let update_flag = 1;
        let tmp_max_acc = 0;
        const c = classifier
        const formatDecimal = d3.format(".2f")
        predictions[c] = { 
          x_roc: [],
          y_roc: [],
          value_roc:[],
          x_pr: [],
          y_pr: [],
          auc_area: 0,
        }; 
        classifierValues[c] = []
        selection.forEach((id)=>{
          const i = instanceById(id);
          if (!classifierValues[c].includes(i.continuous_predictions[c]))
            classifierValues[c].push(i.continuous_predictions[c])
        })
        classifierValues[c].sort();
        classifierValues[c].forEach((value)=>{
          value = formatDecimal(value)
          let tp = 0;
          let fp = 0;
          let fn = 0;
          let tn = 0;
          selection.forEach((id)=>{
            const i = instanceById(id);
            const predict = i.continuous_predictions[c] < parseFloat(value) ? this.classes[0] : this.classes[1];
            if (i.actual == this.classes[1]) {
              if (predict == i.actual) {
                tp+=1;
              } else {
                fn+=1;
              }
            } else {
              if (predict == i.actual) {
                tn+=1;
              } else {
                fp+=1;
              }
            }
          })
          if (tp < last_acc) {
            update_flag = 0;
          }
          if (update_flag == 1 && tp >= last_acc) {
            last_change_index += 1;
            last_acc = tp;
          }
          if (tp+tn > tmp_max_acc) {
            tmp_max_acc = tp+tn;
          }

          coordinates.push({"x":fp/(fp+tn), "y":tp/(tp+fn)});
          predictions[c].x_roc.push((fp/(fp+tn)))
          predictions[c].y_roc.push((tp/(tp+fn)))
          predictions[c].value_roc.push(value)
          predictions[c].x_pr.push((tp/(tp+fn)))
          predictions[c].y_pr.push((tp/(tp+fp)))
        }) 
          

        let lastx = 0;
        let lasty = 0;
        coordinates.sort(function(x, y){
          return d3.ascending(x.x, y.x);
        })
        coordinates.forEach((cor)=>{
          auc += (((cor.y + lasty) * (cor.x - lastx) / 2))
          lastx = cor.x;
          lasty = cor.y;
        })
        return predictions[c]
      }

      if (first) {
        let predictions = {'name': '1'}
        classifiers.forEach((c)=>{
          predictions[c] = calculate_value(c, first.instances)
        })
        this.selectedCurves.push(predictions)
      } 
      if (second) {
        let predictions = {'name': '2'}
        classifiers.forEach((c)=>{
          predictions[c] = calculate_value(c, second.instances)
        })
        this.selectedCurves.push(predictions)
      }
      
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
  
</style>
