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
            <span>(Trinary) Performance Confidence</span>
          </div>
        </v-expansion-panel-header>
        <v-expansion-panel-content>
        </v-expansion-panel-content>
        <v-expansion-panel-content>
          <div style="margin: 0px 30px;">
            <v-radio-group v-model="distribution" label="Distribution Mode">
              <v-radio label="original distribution" value="original"></v-radio>
              <v-radio label="trinary distribution" value="trinary"></v-radio>
            </v-radio-group>
          </div>
        </v-expansion-panel-content>
        <v-expansion-panel-content>
          <div style="margin: 0px 30px;">
            <v-radio-group v-model="selection_mode" label="Selection Mode">
              <v-radio label="overall confidence " value="overall"></v-radio>
              <v-radio label="selection confidence" value="selected"></v-radio>
            </v-radio-group>
          </div>
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
    <div id="legend1" >

    <v-switch
      v-if="selection_mode == 'overall'"
      v-model="normalization_switch"
      label="normalize"
      class="ml-8"
      style="font-size: 12px"
    ></v-switch>
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
  name: 'Trinary_Performance_Confidence',
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
    const hover = {
      type: '' as 'right' | 'wrong' | '',
      selection:'' as '1' | '2',
      classifier: '',
      interval:''
    };
    const hover_distribution = {
      type: '' as 'right' | 'wrong' | '',
      classifier: '',
      interval:''
    };
    const distribution = 'trinary' as 'trinary' | 'original' 
    const selection_mode = 'overall' as 'overall' | 'selected'
    return {
      selection_mode:'overall',
      maxIntervals:0,
      distribution,
      hover_distribution,
      normalization:'No',
      height,
      hover,
      margin,
      curclick:[],
      panel: [],
      rightColor: '#b8ddf2',
      width,
      selectedEval:'',
      wrongColor: '#f7c8aa',
      rightColor1: '#b8ddf2',
      wrongColor1: '#f7c8aa',
      rightHoverColor1: '#4ba0ce',
      wrongHoverColor1: '#ff884d',
      rightHoverColor: '#4393c3',
      wrongHoverColor: '#d6604d',
      selection1Color: '#18FFFF',
      selection2Color: '#FF4081',
      nameTocontinuous: {},
    };
  },
  computed: {
    addedThresholdClassifiers(): [] {
      if (this.$store.state.datasetType != "continuous") {
        return []
      }
      return this.$store.state.addedThresholdClassifiers.map((c)=>c.name);
    },
    addedBandWidthClassifiers() {
      if (this.$store.state.addedBandWidthClassifiers.length == 0) {
        const value = Object.keys(this.$store.state.classifierThresholdDict).map((c)=> {
          let threshold = (this.$store.state.classifierThresholdDict[c] / 100)
          return {'name': c + '(' + ((threshold-0.05) < 0 ? 0 : threshold-0.05).toFixed(2) + ',' + ((threshold+0.05 > 1 ? 1: threshold+0.05)).toFixed(2) + ')' }
        });
        return value
      }
      return this.$store.state.addedBandWidthClassifiers;
    },
    normalization_switch: {
      set() {
        if (this.normalization == "Yes") {
          this.normalization = "No"
        } else {
          this.normalization = "Yes"
        }
      },
      get() {
        return this.normalization === "Yes";
      }
    },
    bandWidthClassifiers(): string[] {
      let classifiers = []
      this.classifiers.forEach((c)=>{
        classifiers.push(c)
      })
      this.addedThresholdClassifiers.forEach((classifier)=>{
          classifiers.push(classifier)
      })
      return classifiers;
    },
    classifierBandWidthDict(): string[] {
      if (this.distribution == 'original') {
        const thresholdRange = this.boxProps.classifierBandWidthDict;
        const classifiers = this.bandWidthClassifiers;
        if (Object.keys(thresholdRange).length == 0 || classifiers.length != Object.keys(thresholdRange).length ) {
            classifiers.forEach((c) => {
              if (!Object.keys(thresholdRange).includes(c) ) {
                thresholdRange[c] = {
                  name:c,
                  threshold: Object.keys( this.classifierThresholds).includes(c)? this.classifierThresholds[c] : 0,
                  left_range:  !Object.keys( this.classifierThresholds).includes(c)? 0 : this.classifierThresholds[c] / 100 - 0.05 < 0 ? 0 : this.classifierThresholds[c] / 100 - 0.05,
                  right_range: !Object.keys( this.classifierThresholds).includes(c)? 0 : this.classifierThresholds[c] / 100 + 0.05 > 1 ? 1 : this.classifierThresholds[c] / 100 + 0.05
                }
              }  
            })
          }
        return thresholdRange
      } 
      let tmp = []
      let classifiers = this.addedBandWidthClassifiers.map((c)=>{
        return c.name
      })
      classifiers.forEach((c)=>{
        let classifier = c.split('(')[0]
        let left_edge = parseFloat(c.substring(c.length-10, c.length-6)).toFixed(2)
        let right_edge = parseFloat(c.substring(c.length-5, c.length-1)).toFixed(2)
        let cur_threshold  = ((parseFloat(right_edge) + parseFloat(left_edge)) / 2).toFixed(2)
        tmp[c] = {
          name:c,
          threshold:cur_threshold,
          left_range: left_edge,
          right_range: right_edge
        }
      })
      return tmp;
    },
    bandWidthChangedClassifierName(): string {
      return this.$store.state.bandWidthChangedClassifierName
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
    confidenceIndex() : {} {
      let confidenceIndex  = {}
      for (let i in this.confidence) {
        confidenceIndex[this.confidence[i]] = parseInt(i)
      }
      return confidenceIndex
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
    continuousPredictionKeys():string[]{
      if (this.$store.state.datasetType == "continuous") {
        var continuousPredictionKeys = []
        this.classifiers.forEach((c)=>{
          continuousPredictionKeys.push(c+"_"+this.$store.state.classifierThresholdDict[c]/100)
          this.nameTocontinuous[c] = c+"_"+this.$store.state.classifierThresholdDict[c]/100
        })
        this.addedThresholdClassifiers.forEach((c)=>{
          continuousPredictionKeys.push(c)
        })
        return continuousPredictionKeys
      } else {
        return this.predictionKeys;
      }
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
    predictions(): {
      [classifier: string]: {
        name: String,
        threshold: Number,
        acc: Number,
        ci_tp: number[],
        ci_fn: number[],
        ci_tn: number[],
        ci_fp: number[],
        ci_mn: number[],
        ci_mp: number[],
        ci_pred: number[],
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
        ci_mp_instances: {
          [confidence: string]:{
            instances: Set<String>,
          }
        },
        ci_mn_instances: {
          [confidence: string]:{
            instances: Set<String>,
            }
          },
        all_instances: {
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
          threshold: number,
          acc: number,
          ci_tp: number[],
          ci_fn: number[],
          ci_tn: number[],
          ci_fp: number[],
          ci_mn: number[],
          ci_mp: number[],
          ci_pred: number[],
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
          ci_mp_instances: {
          [confidence: string]:{
            instances: Set<String>,
          }
          },
          ci_mn_instances: {
            [confidence: string]:{
              instances: Set<String>,
              }
          },
          all_instances: {
          [confidence: string]:{
            instances: Set<String>,
            }
          },
          continuous_pred: Number[]
        },
      } = {};
      var allIntervals = [];

      
      if (this.distribution == 'trinary') {
          this.addedBandWidthClassifiers.forEach((origin_c)=>{
          let c = origin_c.name;
          let classifier = c.split('(')[0]
          let left_edge = parseFloat(c.substring(c.length-10, c.length-6)).toFixed(2)
          let right_edge = parseFloat(c.substring(c.length-5, c.length-1)).toFixed(2)
          let cur_threshold  = (parseFloat(right_edge) + parseFloat(left_edge)) / 2
          predictions[c] = {
            name:c,
            threshold: cur_threshold,
            acc: 0,
            ci_tp: [],
            ci_fn: [],
            ci_tn: [],
            ci_fp: [],
            ci_mn: [],
            ci_mp: [],
            ci_pred: [],
            ci_tp_instances: {},
            ci_fp_instances: {},
            ci_tn_instances: {},
            ci_fn_instances: {},
            ci_mp_instances: {},
            ci_mn_instances: {},
            all_instances: {},
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
            predictions[c]["ci_mp_instances"][conf] = {
              instances: new Set(),
            }
            predictions[c]["ci_mn_instances"][conf] = {
              instances: new Set(),
            }
            predictions[c]["all_instances"][conf] = {
              instances: new Set(),
            }
          })
          this.instances.forEach((id)=>{
            let continuous_value = (instanceById(id).continuous_predictions[classifier])
            let correct = instanceById(id).actual == instanceById(id).predictions[classifier]? 1 : 0;
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

            predictions[c]["all_instances"][interval].instances.add(id);
            if (continuous_value > left_edge && continuous_value < right_edge) {
                if (continuous_value >=  (predictions[c].threshold) / 100) {
                  predictions[c]["ci_mp_instances"][interval].instances.add(id)
                } else {
                  predictions[c]["ci_mn_instances"][interval].instances.add(id)
                }
            } else if (continuous_value >= right_edge){
              if (instanceById(id).actual == this.classes[1]){
                predictions[c]["ci_tp_instances"][interval].instances.add(id)
              } else {
                predictions[c]["ci_fp_instances"][interval].instances.add(id)
              }
            } else{
              if (instanceById(id).actual == this.classes[0]) {
                predictions[c]["ci_tn_instances"][interval].instances.add(id)
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
            predictions[c]["ci_mp"].push(predictions[c]["ci_mp_instances"][conf].instances.size)
            predictions[c]["ci_mn"].push(predictions[c]["ci_mn_instances"][conf].instances.size)
            allIntervals.push(predictions[c]["ci_tn_instances"][conf].instances.size + predictions[c]["ci_tp_instances"][conf].instances.size + predictions[c]["ci_fn_instances"][conf].instances.size + predictions[c]["ci_fp_instances"][conf].instances.size)
          });

          for (let i in predictions[c]["ci_tp"]) {
            predictions[c]["ci_pred"].push(predictions[c]["ci_tp"][i] + predictions[c]["ci_tn"][i] + predictions[c]["ci_fp"][i] +
                                          predictions[c]["ci_fn"][i] + predictions[c]["ci_mp"][i] + predictions[c]["ci_mn"][i] )

          }


        })
      } else {
          this.classifiers.forEach((c) => {
          let left_edge = Object.keys(this.classifierBandWidthDict).length == 0? 0.45: this.classifierBandWidthDict[c].left_range;//this.thresholdRange[c].left_range;
          let right_edge = Object.keys(this.classifierBandWidthDict).length == 0? 0.55: this.classifierBandWidthDict[c].right_range; //this.thresholdRange[c].right_range; 
          let cur_acc = 0
          predictions[c] = {
            name:c,
            threshold: Object.keys( this.classifierThresholds).includes(c)? this.classifierThresholds[c] : 0,
            acc: 0,
            ci_tp: [],
            ci_fn: [],
            ci_tn: [],
            ci_fp: [],
            ci_mn: [],
            ci_mp: [],
            ci_pred: [],
            ci_tp_instances: {},
            ci_fp_instances: {},
            ci_tn_instances: {},
            ci_fn_instances: {},
            ci_mp_instances: {},
            ci_mn_instances: {},
            all_instances: {},
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
            predictions[c]["ci_mp_instances"][conf] = {
              instances: new Set(),
            }
            predictions[c]["ci_mn_instances"][conf] = {
              instances: new Set(),
            }
            predictions[c]["all_instances"][conf] = {
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
            
            predictions[c]["all_instances"][interval].instances.add(id);
            if (continuous_value > left_edge && continuous_value < right_edge) {
                if (continuous_value >=  (predictions[c].threshold) / 100) {
                  predictions[c]["ci_mp_instances"][interval].instances.add(id)
                } else {
                  predictions[c]["ci_mn_instances"][interval].instances.add(id)
                }
            } else if (continuous_value >= right_edge){
              if (instanceById(id).actual == this.classes[1]){
                predictions[c]["ci_tp_instances"][interval].instances.add(id)
              } else {
                predictions[c]["ci_fp_instances"][interval].instances.add(id)
              }
            } else{
              if (instanceById(id).actual == this.classes[0]) {
                predictions[c]["ci_tn_instances"][interval].instances.add(id)
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
            predictions[c]["ci_mp"].push(predictions[c]["ci_mp_instances"][conf].instances.size)
            predictions[c]["ci_mn"].push(predictions[c]["ci_mn_instances"][conf].instances.size)
            allIntervals.push(predictions[c]["ci_tn_instances"][conf].instances.size + predictions[c]["ci_tp_instances"][conf].instances.size + predictions[c]["ci_fn_instances"][conf].instances.size + predictions[c]["ci_fp_instances"][conf].instances.size)
          });

          for (let i in predictions[c]["ci_tp"]) {
            predictions[c]["ci_pred"].push(predictions[c]["ci_tp"][i] + predictions[c]["ci_tn"][i] + predictions[c]["ci_fp"][i] +
                                          predictions[c]["ci_fn"][i] + predictions[c]["ci_mp"][i] + predictions[c]["ci_mn"][i] )

          }
        });
      }
      
      this.maxIntervals = d3.max(allIntervals) *0.9 ;
      this.x.domain([0,d3.max(allIntervals)*2])
      return predictions;
    },
    selections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    x(): d3.ScaleLinear<number, number> {
      let classifiers = this.addedBandWidthClassifiers.map((c)=>{
        c.name
      })
      const x = d3.scaleLinear()
        .range([0, this.width / classifiers.length])
        .domain([0,100])
      return x;    
    },
    xRight(): d3.ScaleLinear<number, number> {
      let classifiers = this.addedBandWidthClassifiers.map((c)=>{
        c.name
      })
      const x = d3.scaleLinear()
        .range([0, this.width / classifiers.length])
        .domain([0,1])
      return x;    
    },
    y(): d3.ScaleBand<string> {
      const y = d3.scaleBand<string>()
        .range([this.height, 0])
        .padding(0.1).domain(this.confidence);
      return y;
    },
    yScale(): d3.ScaleLinear<number, number> {
      const yScale = d3.scaleLinear()
          .domain([0, 1])
          .range([this.height,0])
      return yScale;      
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
        if (view.name == 'Trinary_Performance_Confidence') {
          if (view.config) {
            let value  = view.config;
            this.selection_mode = value.selection
            this.distribution = value.distribution
          }
        }
      })
      this.drawInitial();
    },
    saveStatus() {
      let config = {"name":"Trinary_Performance_Confidence", 
                    "config": {
                      "selection":this.selection_mode,
                      "distribution":this.distribution}}
      this.$store.dispatch("changedSaveConfig",config)
    },
    addedBandWidthClassifiers() {
      this.drawInitial();
    },
    selection_mode() {
      this.drawInitial();
    },
    normalization() {
      if (this.distribution == 'original') {
        this.drawOriginalDistribution();
      } else {
        this.drawInitial();
      }
    },
    hover_distribution() {
      this.drawDistributionHover();
    },
    hover() {
      this.drawHover();
    },
    instances() {
      if (this.distribution == 'original') {
        this.drawOriginalDistribution();
      } else {
        this.drawInitial();
      }
    },
    selections() {
      if (this.selection_mode == 'selected') {
        this.drawInitial();
      }
      this.drawSelections();
      this.drawDistSelections();
    },
    distribution() {
      if (this.distribution == 'original') {
        this.drawOriginalDistribution();
      } else {
        this.drawInitial();
      }
    },
  },
  mounted() {
    let viewsConfig = this.$store.state.viewsConfig;
    viewsConfig.forEach((view)=>{
      if (view.name == 'Trinary_Performance_Confidence') {
        if (view.config) {
          let value  = view.config;
          this.selection_mode = value.selection
          this.distribution = value.distribution
        }
      }
    })
    this.drawInitial();
  },
  methods: {
    dataUpdateWithRange() {
      const classifier = this.bandWidthChangedClassifierName;//this.sliderRange.classifier;

      // find the upper and lower bound of the confidence
      const left_edge =this.classifierBandWidthDict[classifier].left_range; //this.thresholdRange[classifier].left_range;
      const right_edge = this.classifierBandWidthDict[classifier].right_range; //this.thresholdRange[classifier].right_range; 
      let lowerConfi = 0;
      let upperConfi = 0;
      let pre = -0.1
      this.confidence.forEach((c)=>{
        if (left_edge <= c && left_edge > pre) {
          lowerConfi = pre
        }
        if (right_edge <= c && right_edge > pre) {
          upperConfi = c
        }
        pre = c
      }) 

      // updtae corresponding predictions
      for (let i in this.confidence) {
        let conf = this.confidence[i]
        let cur_instances = [...this.predictions[classifier]["all_instances"][conf].instances];
        let interval = conf
        if (conf >= lowerConfi && conf <= upperConfi) {
          this.predictions[classifier]["ci_tp_instances"][conf]["instances"] = new Set();
          this.predictions[classifier]["ci_tn_instances"][conf]["instances"] = new Set();
          this.predictions[classifier]["ci_fp_instances"][conf]["instances"] = new Set();
          this.predictions[classifier]["ci_fn_instances"][conf]["instances"] = new Set();
          this.predictions[classifier]["ci_mp_instances"][conf]["instances"] = new Set();
          this.predictions[classifier]["ci_mn_instances"][conf]["instances"] = new Set();
          cur_instances.forEach((id)=>{
            let continuous_value = (instanceById(id).continuous_predictions[classifier])
            let correct = instanceById(id).actual == instanceById(id).predictions[classifier]? 1 : 0;
            if (continuous_value > left_edge && continuous_value < right_edge) {
                if (continuous_value >= this.predictions[classifier].threshold || parseFloat (interval) > this.predictions[classifier].threshold / 100) {
                  this.predictions[classifier]["ci_mp_instances"][interval].instances.add(id)
                } else {
                  this.predictions[classifier]["ci_mn_instances"][interval].instances.add(id)
                }
            } else if (continuous_value >= right_edge){
              if (instanceById(id).actual == this.classes[1]){
                this.predictions[classifier]["ci_tp_instances"][interval].instances.add(id)
              } else {
                this.predictions[classifier]["ci_fp_instances"][interval].instances.add(id)
              }
            } else{
              if (instanceById(id).actual == this.classes[0]) {
                this.predictions[classifier]["ci_tn_instances"][interval].instances.add(id)
              } else {
                this.predictions[classifier]["ci_fn_instances"][interval].instances.add(id)
              }
            }
          })
          this.predictions[classifier].ci_tp[i] = this.predictions[classifier]["ci_tp_instances"][conf]["instances"].size;
          this.predictions[classifier].ci_tn[i] = this.predictions[classifier]["ci_tn_instances"][conf]["instances"].size;
          this.predictions[classifier].ci_fp[i] = this.predictions[classifier]["ci_fp_instances"][conf]["instances"].size;
          this.predictions[classifier].ci_fn[i] = this.predictions[classifier]["ci_fn_instances"][conf]["instances"].size;
          this.predictions[classifier].ci_mp[i] = this.predictions[classifier]["ci_mp_instances"][conf]["instances"].size;
          this.predictions[classifier].ci_mn[i] = this.predictions[classifier]["ci_mn_instances"][conf]["instances"].size;
          this.predictions[classifier].ci_pred[i] = (this.predictions[classifier].ci_tp[i] + this.predictions[classifier].ci_tn[i] + this.predictions[classifier].ci_fp[i] +
                  this.predictions[classifier].ci_fn[i] + this.predictions[classifier].ci_mp[i] + this.predictions[classifier].ci_mn[i]);
        }
      }
    },
    drawUpdateWithRange(){
      const classifier = this.bandWidthChangedClassifierName;
      const instances = this.instances;
      const yScale = this.yScale
      const chart = d3.select(this.$refs.svg);

      chart.select('.slider-circle-time-from-'+classifier).attr('transform', (d:string)=>
               'translate(0,'+ yScale( this.classifierBandWidthDict[this.bandWidthChangedClassifierName].left_range.toFixed(2)) +')'+'rotate(30)')
      chart.select('.slider-circle-time-to-'+classifier).attr('transform', (d:string)=>
               'translate(0,'+ yScale( this.classifierBandWidthDict[this.bandWidthChangedClassifierName].right_range.toFixed(2)) +')'+'rotate(30)')
      chart.select('.slider-line-'+classifier).attr("y1",(d:string)=>yScale( this.classifierBandWidthDict[this.bandWidthChangedClassifierName].left_range.toFixed(2)))
                .attr("y2",(d:string)=>yScale( this.classifierBandWidthDict[this.bandWidthChangedClassifierName].right_range.toFixed(2)))
      
      this.dataUpdateWithRange();
      this.drawConfidence();
    },
    clearDistributionHover() {
      this.hover_distribution = ({type: '', classifier: '', interval:''})
    },
    clearHover() { 
      this.hover = ({type: '', selection: '', classifier: '',interval:''});
    },
    drawHover() {
      const chart = d3.select(this.$refs.svg);
      const rightBars = chart.selectAll('.bar-right1');
      const wrongBars = chart.selectAll('.bar-wrong1');
      const rightBars2 = chart.selectAll('.bar-right2');
      const wrongBars2 = chart.selectAll('.bar-wrong2');
      const midBars = chart.selectAll('.bar-middle1');
      const midBars2 = chart.selectAll('.bar-middle2');
      const hoverRect = chart.select(".y-axis-marker-rect")
      const yAxisMarkerTextRight = chart.select('.y-axis-marker-text-right1');
      const yAxisMarkerTextWrong = chart.select('.y-axis-marker-text-wrong1');
      const yAxisMarkerTextMiddle = chart.select('.y-axis-marker-text-middle1');
      const yAxisMarkerTextRight_s1 = chart.select('.y-axis-marker-text-right1-s1');
      const yAxisMarkerTextWrong_s1 = chart.select('.y-axis-marker-text-wrong1-s1');
      const yAxisMarkerTextMiddle_s1 = chart.select('.y-axis-marker-text-middle1-s1');
      const yAxisMarkerTextRight_s2 = chart.select('.y-axis-marker-text-right1-s2');
      const yAxisMarkerTextWrong_s2 = chart.select('.y-axis-marker-text-wrong1-s2');
      const yAxisMarkerTextMiddle_s2 = chart.select('.y-axis-marker-text-middle1-s2');

      const { first, second } = this.selections; //rightHeight(d["classifier"], d["confidence"], first.instances, 1)
      const rightOverLap = (classifierName:string,confidence:string, selection: Set<string>,type) => {
        const instances = type==1? this.predictions[classifierName]["ci_tp_instances"][confidence].instances
                                  :this.predictions[classifierName]["ci_tn_instances"][confidence].instances
        var totalInstances = 0
        totalInstances = this.instances.length
        const overlappingInstances = intersection(instances, selection);
        const confidenceInstancesSize = type==1? (this.predictions[classifierName]["ci_tp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mp_instances"][confidence].instances.size)
                                  :(this.predictions[classifierName]["ci_tn_instances"][confidence].instances + this.predictions[classifierName]["ci_fn_instances"][confidence].instances + this.predictions[classifierName]["ci_mn_instances"][confidence].instances)
        const fractionOfTotalInstances = this.normalization == 'No' ? overlappingInstances.size 
                                      :instances.size == 0 ? 0 : (overlappingInstances.size * 100  / instances.size).toFixed(0);
        return fractionOfTotalInstances;
      };

      const wrongOverLap = (classifierName:string, confidence:string, selection: Set<string>, type) => {
        const instances = type == 1? this.predictions[classifierName]["ci_fp_instances"][confidence].instances
                                    :this.predictions[classifierName]["ci_fn_instances"][confidence].instances
        var totalInstances = 0
        totalInstances = this.instances.length
        const overlappingInstances = intersection(instances, selection);
        const confidenceInstancesSize = type==1? (this.predictions[classifierName]["ci_tp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mp_instances"][confidence].instances.size)
                                  :(this.predictions[classifierName]["ci_tn_instances"][confidence].instances + this.predictions[classifierName]["ci_fn_instances"][confidence].instances + this.predictions[classifierName]["ci_mn_instances"][confidence].instances)

        const fractionOfTotalInstances = this.normalization == 'No' ? overlappingInstances.size 
                                      :instances.size == 0 ? 0 : (overlappingInstances.size * 100 /instances.size).toFixed(0);
        return fractionOfTotalInstances;
      };

      const middleOverLap = (classifierName:string, confidence:string, selection: Set<string>, type) => {
        const instances = type == 1? this.predictions[classifierName]["ci_mp_instances"][confidence].instances
                                    :this.predictions[classifierName]["ci_mn_instances"][confidence].instances
        var totalInstances = 0
        totalInstances = this.instances.length
        const overlappingInstances = intersection(instances, selection);
        const confidenceInstancesSize = type==1? (this.predictions[classifierName]["ci_tp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mp_instances"][confidence].instances.size)
                                  :(this.predictions[classifierName]["ci_tn_instances"][confidence].instances + this.predictions[classifierName]["ci_fn_instances"][confidence].instances + this.predictions[classifierName]["ci_mn_instances"][confidence].instances)

        const fractionOfTotalInstances = this.normalization == 'No' ? overlappingInstances.size 
                                      :instances.size == 0 ? 0 : (overlappingInstances.size * 100 /instances.size).toFixed(0);
        return  fractionOfTotalInstances;
      };
      const classifiers = this. addedBandWidthClassifiers.map((c)=>{
        return c.name
      })
      var xAxis = d3.scalePoint()
          .range([0, this.width])
          .padding(0.5)
          .domain(classifiers);



      if (this.hover.type === 'right1' && this.hover.selection == '') {
        rightBars
          .attr('fill', (d: string) =>
            d["classifier"] === this.hover.classifier && d["confidence"] === this.hover.interval
              ? this.rightHoverColor
              : this.rightColor);
      } else {
        if (this.selection_mode == 'overall')
          rightBars.attr('fill', this.rightColor);
      }
      if (this.hover.type === 'wrong1' && this.hover.selection == '') {
        wrongBars
          .attr('fill', (d: string) =>
            d["classifier"] === this.hover.classifier && d["confidence"] === this.hover.interval
              ? this.wrongHoverColor
              : this.wrongColor);
      } else {
        if (this.selection_mode == 'overall')
          wrongBars.attr('fill', this.wrongColor);
      }
      if (this.hover.type === 'middle1' && this.hover.selection == '') {
        midBars
          .attr('fill', (d: string) =>
            d["classifier"] === this.hover.classifier && d["confidence"] === this.hover.interval
              ? 'grey'
              : 'lightgrey');
      } else {
        if (this.selection_mode == 'overall')
          midBars.attr('fill', 'lightgrey');
      }

      if (this.hover.type === 'right2' && this.hover.selection == '') {
        rightBars2
          .attr('fill', (d: string) =>
            d["classifier"] === this.hover.classifier && d["confidence"] === this.hover.interval
              ? this.rightHoverColor1
              : this.rightColor1);
      } else {
        if (this.selection_mode == 'overall')
          rightBars2.attr('fill', this.rightColor1);
      }

      if (this.hover.type === 'wrong2' && this.hover.selection == '') {
        wrongBars2
          .attr('fill', (d: string) =>
            d["classifier"] === this.hover.classifier && d["confidence"] === this.hover.interval
              ? this.wrongHoverColor1
              : this.wrongColor1);
      } else {
        if (this.selection_mode == 'overall')
          wrongBars2.attr('fill', this.wrongColor1);
      }

      if (this.hover.type === 'middle2' && this.hover.selection == '') {
        midBars2
          .attr('fill', (d: string) =>
            d["classifier"] === this.hover.classifier && d["confidence"] === this.hover.interval
              ? 'grey'
              : 'lightgrey');
      } else {
        if (this.selection_mode == 'overall')
          midBars2.attr('fill', 'lightgrey');
      }



      const moveDuration = 500;
      const disappearDuration = 1000;

      if (this.hover.type){
        hoverRect
           .transition()
            .duration(moveDuration)
            .attr("transform",  "translate(" + (xAxis(this.hover.classifier)-120) + ",0)" )
            .attr('opacity', 1);
        if(this.hover.type == "right1" || this.hover.type == "wrong1" || this.hover.type == "middle1") {
    
          yAxisMarkerTextRight
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)
            .attr("transform", 
              "translate(" + (xAxis(this.hover.classifier)-80) + ",-60)" )
            .text(this.normalization == 'Yes'? "tp (%)" : "tp: "+ (this.predictions[this.hover.classifier]["ci_tp_instances"][this.hover.interval].instances.size));

          yAxisMarkerTextMiddle
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1) 
              .attr("transform",  "translate(" + (xAxis(this.hover.classifier)-80) + ",-40)" )
              .text(this.normalization == 'Yes'? "mp (%)" : "mp:"+(this.predictions[this.hover.classifier]["ci_mp_instances"][this.hover.interval].instances.size));
  
          yAxisMarkerTextWrong
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)  
              .attr("transform",  "translate(" + (xAxis(this.hover.classifier)-80) + ",-20)" )
              .text(this.normalization == 'Yes'? "fp (%)" : "fp:"+(this.predictions[this.hover.classifier]["ci_fp_instances"][this.hover.interval].instances.size));
          if (first) {
            yAxisMarkerTextRight_s1
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .attr("fill","steelblue")
              .attr("transform",  "translate(" + (xAxis(this.hover.classifier)-10) + ",-60)" )
              .text("1st: "+rightOverLap(this.hover.classifier,this.hover.interval, first.instances, 1));

            yAxisMarkerTextMiddle_s1
                .transition()
                .duration(moveDuration)
                .attr('fill-opacity', 1) 
                .attr("fill","steelblue")
                .attr("transform",  "translate(" + (xAxis(this.hover.classifier)-10) + ",-40)" )
                .text("1st: "+middleOverLap(this.hover.classifier,this.hover.interval, first.instances, 1));
    
            yAxisMarkerTextWrong_s1
                .transition()
                .duration(moveDuration)
                .attr("fill","steelblue")
                .attr('fill-opacity', 1)  
                .attr("transform",  "translate(" + (xAxis(this.hover.classifier)-10) + ",-20)" )
                .text("1st: "+wrongOverLap(this.hover.classifier,this.hover.interval, first.instances, 1));
          }
          if (second) {
            yAxisMarkerTextRight_s2
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .attr("fill",this.selection2Color)
              .attr("transform",  "translate(" +  (xAxis(this.hover.classifier)+60)  + ",-60)" )
              .text("2nd: "+rightOverLap(this.hover.classifier,this.hover.interval, second.instances, 1));

            yAxisMarkerTextMiddle_s2
                .transition()
                .duration(moveDuration)
                .attr('fill-opacity', 1) 
                .attr("fill",this.selection2Color)
                .attr("transform",  "translate(" + (xAxis(this.hover.classifier)+60)+ ",-40)" )
                .text("2nd: "+middleOverLap(this.hover.classifier,this.hover.interval, second.instances, 1));
    
            yAxisMarkerTextWrong_s2
                .transition()
                .duration(moveDuration)
                .attr("fill",this.selection2Color)
                .attr('fill-opacity', 1)  
                .attr("transform",  "translate(" + (xAxis(this.hover.classifier)+60) + ",-20)" )
                .text("2nd: "+wrongOverLap(this.hover.classifier,this.hover.interval, second.instances, 1));
          }
        } else {
         
          yAxisMarkerTextRight
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)
            .attr("transform",  "translate(" + (xAxis(this.hover.classifier)-80) + ",-60)" )
            .text(this.normalization == 'Yes'? "tn (%)" : "tn: "+`${(this.predictions[this.hover.classifier]["ci_tn_instances"][this.hover.interval].instances.size)}`);

          yAxisMarkerTextMiddle
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1) 
              .attr("transform",  "translate(" + (xAxis(this.hover.classifier)-80) + ",-40)" )
              .text(this.normalization == 'Yes'? "mn (%)" : "mn: "+`${(this.predictions[this.hover.classifier]["ci_mn_instances"][this.hover.interval].instances.size)}`);
  
          yAxisMarkerTextWrong
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)  
              .attr("transform",  "translate(" + (xAxis(this.hover.classifier)-80) + ",-20)" )
              .text(this.normalization == 'Yes'? "fn (%)" : "fn: "+`${(this.predictions[this.hover.classifier]["ci_fn_instances"][this.hover.interval].instances.size)}`);
          if (first) {
            yAxisMarkerTextRight_s1
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .attr("fill","steelblue")
              .attr("transform",  "translate(" + (xAxis(this.hover.classifier)-10) + ",-60)" )
              .text("1st: "+rightOverLap(this.hover.classifier,this.hover.interval, first.instances, 2));

            yAxisMarkerTextMiddle_s1
                .transition()
                .duration(moveDuration)
                .attr('fill-opacity', 1) 
                .attr("fill","steelblue")
                .attr("transform",  "translate(" + (xAxis(this.hover.classifier)-10) + ",-40)" )
                .text("1st: "+middleOverLap(this.hover.classifier,this.hover.interval, first.instances, 2));
    
            yAxisMarkerTextWrong_s1
                .transition()
                .duration(moveDuration)
                .attr("fill","steelblue")
                .attr('fill-opacity', 1)  
                .attr("transform",  "translate(" + (xAxis(this.hover.classifier)-10) + ",-20)" )
                .text("1st: "+wrongOverLap(this.hover.classifier,this.hover.interval, first.instances, 2));
          }
          if (second) {
            yAxisMarkerTextRight_s2
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .attr("fill",this.selection2Color)
              .attr("transform",  "translate(" + (xAxis(this.hover.classifier)+60) + ",-60)" )
              .text("2nd: "+rightOverLap(this.hover.classifier,this.hover.interval, second.instances, 2));

            yAxisMarkerTextMiddle_s2
                .transition()
                .duration(moveDuration)
                .attr('fill-opacity', 1) 
                .attr("fill",this.selection2Color)
                .attr("transform",  "translate(" + (xAxis(this.hover.classifier)+60)+ ",-40)" )
                .text("2nd: "+middleOverLap(this.hover.classifier,this.hover.interval, second.instances, 2));
    
            yAxisMarkerTextWrong_s2
                .transition()
                .duration(moveDuration)
                .attr("fill",this.selection2Color)
                .attr('fill-opacity', 1)  
                .attr("transform",  "translate(" + (xAxis(this.hover.classifier)+60) + ",-20)" )
                .text("2nd: "+wrongOverLap(this.hover.classifier,this.hover.interval, second.instances, 2));
          }
        }

      } else {

        yAxisMarkerTextRight
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerTextMiddle
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerTextWrong
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerTextRight_s1
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerTextMiddle_s1
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerTextWrong_s1
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerTextRight_s2
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerTextMiddle_s2
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerTextWrong_s2
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        // yAxisMarkerLine2
        //   .transition()
        //   .duration(disappearDuration)
        //   .attr('stroke-opacity', 0);
        // yAxisMarkerLine2_2
        //   .transition()
        //   .duration(disappearDuration)
        //   .attr('stroke-opacity', 0);
        hoverRect
          .transition()
          .duration(disappearDuration)
          .attr('opacity', 0);
      }
    },
    drawDistributionHover() {
      const chart = d3.select(this.$refs.svg);
      const predBars = chart.selectAll('.bar-original');
      const hoverRect = chart.select(".y-axis-marker-rect-dist")
      const yAxisMarkerTextPred = chart.select('.y-axis-marker-text-pred');
      const yAxisMarkerTextPred_s1 = chart.select('.y-axis-marker-text-pred-s1');
      const yAxisMarkerTextPred_s2 = chart.select('.y-axis-marker-text-pred-s2');
      const yAxisMarkerLine = chart.select('.y-axis-marker-line-dist');
      const moveDuration = 500;
      const disappearDuration = 1000;
      const { first, second } = this.selections; 
      
      const rightOverLap = (classifierName:string,confidence:string, selection: Set<string>,type) => {
        const instances = new Set([...this.predictions[classifierName]["ci_tp_instances"][confidence].instances
                                  , ...this.predictions[classifierName]["ci_fn_instances"][confidence].instances
                                  , ...this.predictions[classifierName]["ci_tn_instances"][confidence].instances
                                  , ...this.predictions[classifierName]["ci_fp_instances"][confidence].instances
                                  , ...this.predictions[classifierName]["ci_mn_instances"][confidence].instances
                                  , ...this.predictions[classifierName]["ci_mp_instances"][confidence].instances
                                  ]);
        var totalInstances = 0
        totalInstances = this.instances.length
        const overlappingInstances = intersection(instances, selection);
        const fractionOfTotalInstances = overlappingInstances.size /// totalInstances;
        return fractionOfTotalInstances;
      };
      let classifiers = []
      this.classifiers.forEach((c)=>{
        classifiers.push(c)
      })
      this.addedThresholdClassifiers.forEach((classifier)=>{
          classifiers.push(classifier)
      })
      const xAxis = d3.scalePoint()
          .range([0, this.width])
          .padding(0.5)
          .domain(classifiers);

      var confi_index = '0';
      for (let i in this.confidence) {
        if (this.confidence[i] == this.hover_distribution.interval) {
          confi_index = i
          break
        }
      }

      if (this.hover_distribution.type === 'dist') {
        predBars
          .attr('fill', (d: string) =>
            d["classifier"] === this.hover_distribution.classifier && d["confidence"] === this.hover_distribution.interval
              ? this.rightHoverColor
              : this.rightColor);
      } else {
        predBars.attr('fill', this.rightColor);
      }

      if (this.hover_distribution.type){
        hoverRect
           .transition()
            .duration(moveDuration)
            .attr("transform",  "translate(" + (xAxis(this.hover_distribution.classifier)-60) + ",0)" )
            .attr('opacity', 1);
       
        yAxisMarkerLine
          .transition()
          .duration(moveDuration)
          .attr('stroke-opacity', 1)
          .attr("transform",  "translate(" + xAxis(this.hover_distribution.classifier) + ",0)" )
          .attr('x1', this.x(this.predictions[this.hover_distribution.classifier]["ci_pred"][confi_index]) )
          .attr('y1',-20)
          .attr('y2', this.height*1.2)
          .attr('x2', this.x(this.predictions[this.hover_distribution.classifier]["ci_pred"][confi_index]) );
      
        yAxisMarkerTextPred
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)  
            .attr("transform",  "translate(" + (xAxis(this.hover_distribution.classifier)) + ",-55)" )
            .text("pred:"+(this.predictions[this.hover_distribution.classifier]["ci_pred"][confi_index]));

        if (first) {
          yAxisMarkerTextPred_s1
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)
            .attr("fill","steelblue")
            .attr("transform",  "translate(" + (xAxis(this.hover_distribution.classifier)) + ",-40)" )
            .text("1st: "+rightOverLap(this.hover_distribution.classifier,this.hover_distribution.interval, first.instances, 1));
        }
        if (second) {
          yAxisMarkerTextPred_s2
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)
            .attr("fill",this.selection2Color)
            .attr("transform",  "translate(" +  (xAxis(this.hover_distribution.classifier))  + ",-25)" )
            .text("2nd: "+rightOverLap(this.hover_distribution.classifier,this.hover_distribution.interval, second.instances, 1)); 
        }
      } else {

        yAxisMarkerLine
          .transition()
          .duration(disappearDuration)
          .attr('stroke-opacity', 0);

        yAxisMarkerTextPred
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
 
        yAxisMarkerTextPred_s1
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerTextPred_s2
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);

        hoverRect
          .transition()
          .duration(disappearDuration)
          .attr('opacity', 0);
      }
      
    },
    drawInitial() {
      // @ts-ignore
      d3.select(this.$refs.svg).selectAll('*').remove();
      // @ts-ignore
      const svgAll = d3.select(this.$refs.svg).append('svg')
        .attr("class","svg-all")
        .attr('width', '100%')
        .attr('viewBox', `0 0
          ${this.width + this.margin.left + this.margin.right}
          ${this.height + this.margin.top + this.margin.bottom * 2}`)
        
      const svg_confidence = svgAll.append('g')
          .attr("class","svg-confidence")
          .attr('transform', `translate(${this.margin.left/4}, ${this.margin.bottom * 1.5})`);
      const svg = svgAll.append('g')
          .attr('transform', `translate(${this.margin.left/4}, ${this.margin.bottom * 1.5 })`);

      const classifiers = this. addedBandWidthClassifiers.map((c)=>{
        return c.name
      })
      const x = this.x
      const y = this.y    
      const height = this.height
      const x_width = this.width / classifiers.length
      var xAxis = d3.scalePoint()
          .range([0, this.width])
          .padding(0.5)
          .domain(classifiers);

          


      const drawSliders = () => {
        let yScale = this.yScale
        let thresholdRange = this.classifierBandWidthDict//this.thresholdRange
        
 
        var sqrt3 = Math.sqrt(3);

        const rangeSliders = svg.append("g").selectAll("g")
          .data(classifiers)
          .enter().append("g")
            .attr("transform", function(d:string) { return "translate(" + (xAxis(d)) + ")"; })
        
        let slider = rangeSliders.append('line')
          .attr('class',(d:string)=>'slider-line-'+d)
          .style("stroke", "#777")
          .style("stroke-opacity", "1")
          .style("stroke-width", "4")
          .attr('x1', 0)
          .attr('x2', 0)
          .attr('y1',(d:string)=> {
            return yScale( thresholdRange[d].left_range)})
          .attr('y2',(d:string)=> {
            return yScale( thresholdRange[d].right_range)})

        let head1 = rangeSliders.append('circle')
          .style('fill', 'red')
          .attr("r",y.bandwidth()/6)
          .style('stroke', 'none')
          .attr('class',(d:string)=>'slider-circle-time-from'+d)
          .attr('transform', (d:string)=>{
            return 'translate(0,'+ yScale( thresholdRange[d].left_range) +')'+'rotate(30)'
          })
          .attr("id",(d:string)=>"slider-circle-time-to-left_"+d)
            ;

        let head2 = rangeSliders.append('circle')
          .style('fill', 'green')
          .attr("r",y.bandwidth() / 6)
          .style('stroke', 'none')
          .attr('class',(d:string)=>'slider-circle-time-to'+d)
          .attr('transform', (d:string)=>{
            return 'translate(0,'+ yScale( thresholdRange[d].right_range) +')'+'rotate(30)'
          })
          .attr("id",(d:string)=>"slider-circle-time-to-right_"+d);

        let thresholdCircle = rangeSliders.append('circle')
          .attr('class', 'x-axis-marker-line')
          .attr('transform', (d:string)=>{
            return 'translate(0,'+ yScale(thresholdRange[d].threshold) +')'+'rotate(30)'
          })
          .attr("r",y.bandwidth()/4)
          .attr('fill', 'drakblue')
          .attr('stroke-opacity', 1)
      };
      
      const drawTitles = () => {
        svg.selectAll("myText")
          .data(classifiers)
          .enter().append("text")
              .style("text-anchor", "middle")
              .attr('transform', 'rotate(30)')
              .attr("transform", function(d: string) { 
              return "translate(" + (xAxis(d)+10) + ","+(height+40)+") " + 'rotate(20)'; })
              .text((d:string)=>d)
              .style("fill", "black")
              .style("font-size", 20)

         

      };
      
      const drawLegend = () => {
        const width = this.width / 8;
        const height = this.margin.top / 1.5;
        const legend = svg
          .append('g')
            .attr('class', 'legend')
            .attr('transform', this.selection_mode == 'selected'?
             `translate(
              ${this.width - width},
              ${-height*4})`
            : `translate(
              ${this.width - width},
              ${-height*6})`
            );

        if (this.selection_mode == 'selected') {
          legend.append('rect')
            .attr('width', width )
            .attr('height', height)
            .attr('fill', this.selection1Color)
            .attr("stroke",'black')
          legend.append('rect')
            .attr('x', width )
            .attr('width', width )
            .attr('height', height)
            .attr('fill', this.selection1Color)
            .attr("stroke",'black')
          legend.append('rect')
            .attr('y', height)
            .attr('width', width )
            .attr('height', height)
            .attr('fill', this.selection2Color)
            .attr("stroke",'black')
          legend.append('rect')
            .attr('y', height)
            .attr('x', width )
            .attr('width', width )
            .attr('height', height)
            .attr('fill', this.selection2Color)
            .attr("stroke",'black')

          legend.append('text')
            .attr('transform', `translate(${width / 2}, ${height / 2})`)
            .attr('font-size', '20px')
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'middle')
            .text( "incorrect s1") 
          legend.append('text')
            .attr('transform', `translate(${width / 2 * 3}, ${height / 2})`)
            .attr('font-size', '20px')
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'middle')
            .text( "correct s1") 
          legend.append('text')
            .attr('transform', `translate(${width / 2}, ${height / 2 * 3})`)
            .attr('font-size', '20px')
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'middle')
            .text( "incorrect s2") 
          legend.append('text')
            .attr('transform', `translate(${width / 2 * 3}, ${height / 2 * 3})`)
            .attr('font-size', '20px')
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'middle')
            .text( "correct s2") 
        } else {
          legend.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', this.wrongColor)

          legend.append('rect')
            .attr('y', height)
            .attr('width', width)
            .attr('height', height)
            .attr('fill', this.rightColor)

          legend.append('rect')
            .attr('y', height*2)
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'lightgrey')  

          legend.append('rect')
            .attr('y', height*3)
            .attr('width', width)
            .attr('height', height)
            .attr('fill', this.wrongColor1)

          legend.append('rect')
            .attr('y', height*4)
            .attr('width', width)
            .attr('height', height)
            .attr('fill', this.rightColor1)    
          
            
          legend.append('text')
            .attr('transform', `translate(${width / 2}, ${height / 2})`)
            .attr('font-size', '20px')
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'middle')
            .text( "fp")  

          legend.append('text')
            .attr('transform', `translate(${width / 2}, ${height * 3 / 2})`)
            .attr('font-size', '20px')
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'middle')
            .text("tp");

          legend.append('text')
            .attr('transform', `translate(${width / 2}, ${height * 2.5})`)
            .attr('font-size', '20px')
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'middle')
            .text("uncertain"); 

          legend.append('text')
            .attr('transform', `translate(${width / 2}, ${height * 3.5})`)
            .attr('font-size', '20px')
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'middle')
            .text( "fn")  

          legend.append('text')
            .attr('transform', `translate(${width / 2}, ${height * 4.5})`)
            .attr('font-size', '20px')
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'middle')
            .text("tn");  
        }
      };
      
      const yAxisMarkerLine = () => {
        svg.append('line')
          .attr('class', 'y-axis-marker-line1')
          .attr('x1', x(0))
          .attr('y1',0)
          .attr('x2', x(0))
          .attr('y2', this.height*1.2)
          .attr('stroke', 'black')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr('pointer-events', 'none');
        svg.append('line')
          .attr('class', 'y-axis-marker-line2')
          .attr('x1', x(0))
          .attr('y1',0)
          .attr('x2', x(0))
          .attr('y2', this.height*1.2)
          .attr('stroke', 'black')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr('pointer-events', 'none');  

        svg.append('line')
          .attr('class', 'y-axis-marker-line1-2')
          .attr('x1', x(0))
          .attr('y1',0)
          .attr('x2', x(0))
          .attr('y2', this.height*1.2)
          .attr('stroke', 'black')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr('pointer-events', 'none');  
        svg.append('line')
          .attr('class', 'y-axis-marker-line2-2')
          .attr('x1', x(0))
          .attr('y1',0)
          .attr('x2', x(0))
          .attr('y2', this.height*1.2)
          .attr('stroke', 'black')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr('pointer-events', 'none');  
      };

      const yAxisMarkerText = () => {
        svg.append("rect")
          .attr('class', 'y-axis-marker-rect')
          .attr("width",240)
          .attr("height",60)
          .attr("fill","white")
          .attr("stroke","grey")
          .attr("y",-60)
          // .duration(disappearDuration)
          .attr('opacity', 0);

        svg.append('text')
          .attr('class', 'y-axis-marker-text-right1')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', this.rightHoverColor)
          .attr('pointer-events', 'hanging');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-right1-s1')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', this.rightHoverColor)
          .attr('pointer-events', 'hanging');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-right1-s2')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', this.rightHoverColor)
          .attr('pointer-events', 'hanging');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-wrong1') 
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', this.wrongHoverColor)
          .attr('pointer-events', 'hanging');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-wrong1-s1') 
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', this.wrongHoverColor)
          .attr('pointer-events', 'hanging');
         svg.append('text')
          .attr('class', 'y-axis-marker-text-wrong1-s2') 
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', this.wrongHoverColor)
          .attr('pointer-events', 'hanging');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-middle1')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', "grey")
          .attr('pointer-events', 'hanging');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-middle1-s1')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', "grey")
          .attr('pointer-events', 'hanging');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-middle1-s2')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', "grey")
          .attr('pointer-events', 'hanging');
      };

      drawSliders();
      drawTitles();
      drawLegend(); 

      yAxisMarkerLine();
      yAxisMarkerText();
      this.drawConfidence();
        if (this.selection_mode == 'overall') {
        this.drawHover();
      }
      
    },
    drawConfidence() {
      const chart = d3.select(this.$refs.svg);
      const svg = chart.select(".svg-confidence");
      const normalization = this.normalization;
      svg.selectAll('*').remove();  

      const x = this.x
      const y = this.y    
      const maxIntervals = this.maxIntervals
      
      const predictions = this.predictions
      const selections = this.selections
      const {first, second} = this.selections
      const confidence  = this.confidence
      const classifiers = this.addedBandWidthClassifiers.map((c)=>{
        return c.name
      })

      var xAxis = d3.scalePoint()
          .range([0, this.width])
          .padding(0.5)
          .domain(classifiers);

      var width = this.width;
      var height = this.height

      let confidenceData = get_confidence_data()
      let confidenceDict = {}
      let selectedConfidenceDict = []
      classifiers.forEach((c,i)=>{
        confidenceDict[c] = confidenceData[i].data
      })

      if (this.selection_mode == 'selected' && Object.keys(this.selections).length > 0) {
        confidenceData = []
        if (first) {
          const selectionData = get_selected_confidence_data("1")
          confidenceData.push(selectionData)
          let tmpconfidenceDict = {}
          classifiers.forEach((c,i)=>{
            tmpconfidenceDict[c] = selectionData[i]['data']
          })
          selectedConfidenceDict.push(tmpconfidenceDict)
        }
        if (second) {
          const selectionData = get_selected_confidence_data("2")
          confidenceData.push(selectionData)
          let tmpconfidenceDict = {}
          classifiers.forEach((c,i)=>{
            tmpconfidenceDict[c] = selectionData[i]['data']
          })
          selectedConfidenceDict.push(tmpconfidenceDict)
        }
      }

      const drawConfidence = () => {
        var yAxis = {}
        for (var i in classifiers) {
          var name = classifiers[i];
          var lowthreshold = 0;
          yAxis[name] = d3.scaleBand() 
            .range([this.height, 0])
            .domain(this.confidence);
        }
        const barCells =  svg.append("g").selectAll("g")
          .data(classifiers)
          .enter().append("g")
            .attr("transform", function(d: string) { 
              return "translate(" + xAxis(d) + ",0)"; }).selectAll("rect")
            .data(function(d: string) { return confidenceDict[d]; })
            .enter()
        // Draw the axis:
        svg.selectAll("myAxis")
          .data(classifiers).enter()
          .append("g")
          .style("font", "28px times")
          .style("text-anchor", "end")
          .style("dominant-baseline","ideographic")
          .attr("transform", function(d:string) { return "translate(" + (xAxis(d)) + ")"; })
          .each(function(d:string) { 
            d3.select(this).call(d3.axisLeft<d3.AxisDomain>(yAxis[d]).scale(yAxis[d])); 
          })

        const barNames = ['right', 'middle', 'wrong'];
        const barInstances1 = ['tp_interval', 'mp_interval', 'fp_interval'];
        const barInstances2 = ['tn_interval', 'mn_interval', 'fn_interval'];
        const colors = [this.rightColor, 'lightgrey', this.wrongColor]
        barNames.forEach((name,index)=>{
          barCells
            .append("rect")
            .attr('class', 'bar-'+ name + '1')
            .attr("transform", (d: string)=> { 
              let count = 0
              let shift = 0
              while (count < index) {
                shift += d[barInstances1[count]]
                count += 1
              }
              return "translate(" + x(shift) + ",0)"; })
            .attr("width", function(d) {
              return x(d[barInstances1[index]]); } )
            .attr("y", function(d) { 
              return y(d["confidence"]); })
            .attr("height", function(d) {
              return y.bandwidth()
            })
            .attr("fill",colors[index])
            .on('mouseenter', (d: string) => this.hover = ({type: name+'1', classifier: d["classifier"], interval: d["confidence"].toString()}))
            .on('mouseleave', this.clearHover)
            .on('click', (d: string) => this.select(d["classifier"], name, 'first',d["confidence"].toString()))
            .on('contextmenu', (d: string) => this.select(d["classifier"], name, 'second',d["confidence"].toString()));
          barCells
            .append("circle")   
            .attr('r',y.bandwidth()/6)
            .attr('class', 'bar-'+ name + '1' + '-circle')
            .attr("transform", (d: string)=> { 
              let count = 0
              let shift = 0
              while (count < index) {
                shift += d[barInstances1[count]]
                count += 1
              }
              let y_shift = -y.bandwidth()/3 + index * (y.bandwidth()/3)
              return "translate(" + x(shift) + ","+y_shift+")"; })
            .attr("cx",y.bandwidth()/6)
            .attr("cy", function(d) { 
              return y(d["confidence"]) + y.bandwidth()/ 2; })
            .attr("visibility", (d) => {
              return x(d[barInstances1[index]]) < y.bandwidth()/6 && (d[barInstances1[index]]) > 0? "visible":"hidden"})
            .attr("fill", colors[index])
            .on('mouseenter', (d: string) => this.hover = ({type: name+'1',classifier: d["classifier"], interval: d["confidence"].toString()}))
            .on('mouseleave', this.clearHover)
            .on('click', (d: string) => this.select(d["classifier"], name, 'first',d["confidence"].toString()))
            .on('contextmenu', (d: string) => this.select(d["classifier"], name, 'second',d["confidence"].toString()));
  
          barCells
            .append("rect")
            .attr('class', 'bar-'+ name + '2')
            .attr("transform", function(d: string) { 
              let count = 0
              let shift = 0
              while (count < 3) {
                shift += d[barInstances1[count]]
                count += 1
              }
              count = 0
              while (count < index) {
                shift += d[barInstances2[count]]
                count += 1
              }
              return "translate(" + x(shift) + ",0)"; })
            .attr("width", function(d) {
              return x(d[barInstances2[index]]); } )
            .attr("y", function(d) { 
              return y(d["confidence"]); })
            .attr("height", function(d) {
              return y.bandwidth()
            })
            .attr("fill", colors[index])  
            .on('mouseenter', (d: string) => this.hover = ({type:  name+'2', classifier: d["classifier"], interval: d["confidence"].toString()}))
            .on('mouseleave', this.clearHover)
            .on('click', (d: string) => this.select(d["classifier"], name+'2', 'first',d["confidence"].toString()))
            .on('contextmenu', (d: string) => this.select(d["classifier"], name+'2', 'second',d["confidence"].toString()));
          
          barCells
            .append("circle")   
            .attr('r',y.bandwidth()/6)
            .attr('class', 'bar-'+ name + '2' + '-circle')
            .attr("transform", function(d: string) { 
              let count = 0
              let shift = 0
              while (count < 3) {
                shift += d[barInstances1[count]]
                count += 1
              }
              count = 0
              while (count < index) {
                shift += d[barInstances2[count]]
                count += 1
              }
              let y_shift = -y.bandwidth()/3 + index * (y.bandwidth()/3)
              return "translate(" + x(shift) + ","+y_shift+")"; })
            .attr("cx",y.bandwidth()/6)
            .attr("cy", function(d) { 
              return y(d["confidence"]) + y.bandwidth()/ 2; })
            .attr("visibility", (d) => {
              return x(d[barInstances2[index]]) < y.bandwidth()/6 && (d[barInstances2[index]]) > 0? "visible":"hidden"})
            .attr("fill", colors[index])  
            .on('mouseenter', (d: string) => this.hover = ({type: name+'2', classifier: d["classifier"], interval: d["confidence"].toString()}))
            .on('mouseleave', this.clearHover)
            .on('click', (d: string) => this.select(d["classifier"], name+'2', 'first',d["confidence"].toString()))
            .on('contextmenu', (d: string) => this.select(d["classifier"], name+'2','second',d["confidence"].toString()));
      
        })

         
        const selections = () => {
          const selectionBarWidth = y.bandwidth() / 4;
          const selections = ['-selection-1', '-selection-2']
          const selectionColors = [this.selection1Color, this.selection2Color]

          barNames.forEach((name, index)=>{
            selections.forEach((selection, selectIndex)=>{
              barCells.append('rect')
                .attr('class', 'bar-' + name + selection)
                .attr("transform", (d: string)=> { 
                  let count = 0
                  let shift = 0
                  while (count < index) {
                    shift += d[barInstances1[count]]
                    count += 1
                  }
                  return "translate(" + x(shift) + ",0)"; })
                .attr('y',function(d){
                  return y(d["confidence"])+0.5 * y.bandwidth()- selectionBarWidth * (1-selectIndex)
                  })
                .attr('height', selectionBarWidth)
                .attr('fill', selectionColors[selectIndex])
                .attr('stroke', 'black')
                .attr('stroke-width', '1px')
                .attr('pointer-events', 'none')
               barCells.append("circle")   
                .attr('class', 'circle-' + name + selection)
                .attr("transform", (d: string)=> { 
                  let count = 0
                  let shift = 0
                  while (count < index) {
                    shift += d[barInstances1[count]]
                    count += 1
                  }
                  return "translate(" + x(shift) + ",0)"; })
                .attr('cy',function(d){
                  return y(d["confidence"])+0.5 * y.bandwidth()- selectionBarWidth * (1-selectIndex) + selectionBarWidth/2
                  })
                .attr("cx",selectionBarWidth/2)
                .attr('r', selectionBarWidth / 2)
                .attr('fill', selectionColors[selectIndex])
                .attr("visibility","hidden")

              barCells.append('rect')
                .attr('class', 'bar-'+ name + '2' + selection)
                .attr("transform", function(d: string) { 
                  let count = 0
                  let shift = 0
                  while (count < 3) {
                    shift += d[barInstances1[count]]
                    count += 1
                  }
                  count = 0
                  while (count < index) {
                    shift += d[barInstances2[count]]
                    count += 1
                  }
                  return "translate(" + x(shift) + ",0)"; })
                .attr('y',(d)=>y(d["confidence"])+  0.5 * y.bandwidth()- selectionBarWidth * (1-selectIndex)) 
                .attr('height', selectionBarWidth)
                .attr('fill', selectionColors[selectIndex])
                .attr('stroke', 'black')
                .attr('stroke-width', '1px')
                .attr('pointer-events', 'none')
              barCells.append("circle")   
                .attr('class', 'circle-' + name + '2' + selection)
                .attr("transform", function(d: string) { 
                  let count = 0
                  let shift = 0
                  while (count < 3) {
                    shift += d[barInstances1[count]]
                    count += 1
                  }
                  count = 0
                  while (count < index) {
                    shift += d[barInstances2[count]]
                    count += 1
                  }
                  return "translate(" + x(shift) + ",0)"; })
                .attr('cy',function(d){
                  return y(d["confidence"])+0.5 * y.bandwidth()- selectionBarWidth * (1-selectIndex) + selectionBarWidth/2
                  })
                .attr("cx",selectionBarWidth/2)
                .attr('r', selectionBarWidth / 2)
                .attr('fill', selectionColors[selectIndex])
                .attr("visibility","hidden")
            })
          })
        };
        selections();
      };

      const drawSelectedConfidence = () => {
        var yAxis = {}

        for (var i in classifiers) {
          var name = classifiers[i];
          var lowthreshold = 0;
          yAxis[name] = d3.scaleBand() 
            .range([this.height, 0])
            .domain(this.confidence);
        }
        
        selectedConfidenceDict.forEach((confidenceDict)=>{
          const barCells =  svg.append("g").selectAll("g")
            .data(classifiers)
            .enter().append("g")
              .attr("transform", function(d: string) { 
                return "translate(" + xAxis(d) + ",0)"; }).selectAll("rect")
              .data(function(d: string) { return confidenceDict[d]; })
              .enter()
            // draw bars
          barCells
            .append("rect")
            .attr('class', 'bar-right1')
            .attr("width", function(d) {
              return x(d["tp_interval"]); } )
            .attr("y", function(d) { 
              return d["type"] == "1" ? y(d["confidence"]) + y.bandwidth()/3 
                                      : y(d["confidence"]) + y.bandwidth()/1.5; })
            .attr("height", function(d) {
              return y.bandwidth()/3
            })
            .attr("fill", (d)=>d['type'] == '1'? this.selection1Color:this.selection2Color)
            .attr("stroke","black")
            .on('mouseenter', (d: string) => this.hover = ({type: 'right1', selection: d['type'], classifier: d["classifier"], interval: d["confidence"].toString()}))
            .on('mouseleave', this.clearHover)

          // draw middel bars
          barCells
            .append("rect")
            .attr('class', 'bar-middle1')
            .attr("transform", function(d: string) { 
                return "translate(" + (x(d["tp_interval"])) + ",0)"; })
            .attr("width", function(d) {
              return x(d["mp_interval"]); } )
            .attr("y", function(d) { 
              return d["type"] == "1" ? y(d["confidence"]) + y.bandwidth()/3
                                      : y(d["confidence"]) + y.bandwidth()/1.5; })
            .attr("height", function(d) {
              return y.bandwidth()/3
            })
            .attr("fill", (d)=>d['type'] == '1'? this.selection1Color:this.selection2Color)
            .attr("stroke","black")
            .on('mouseenter', (d: string) => this.hover = ({type: 'middle1', selection: d['type'],classifier: d["classifier"], interval: d["confidence"].toString()}))
            .on('mouseleave', this.clearHover)
       
          barCells
            .append("rect")
            .attr('class', 'bar-wrong1')
            .attr('id',d=>'bar-wrong1-'+d['classifier']+'-'+d['confidence'])
            .attr("transform", function(d: string) { 
                return "translate(" + (x(d["tp_interval"]+d["mp_interval"])) + ",0)"; })
            .attr("width", function(d) {
              return x(d["tn_interval"]); } )
            .attr("y", function(d) { 
              return d["type"] == "1" ? y(d["confidence"]) + y.bandwidth()/3
                                      : y(d["confidence"]) + y.bandwidth()/1.5; })
            .attr("height", function(d) {
              return y.bandwidth()/3
            })
            .attr("fill", (d)=>d['type'] == '1'? this.selection1Color:this.selection2Color)
            .attr("stroke","black")
            .on('mouseenter', (d: string) => this.hover = ({type: 'wrong1', selection: d['type'],classifier: d["classifier"], interval: d["confidence"].toString()}))
            .on('mouseleave', this.clearHover)

          // draw fn
          barCells
            .append("rect")
            .attr('class', 'bar-right2')
            .attr('id',d=>'bar-right2-'+d['classifier']+'-'+d['confidence'])
            .attr("transform", function(d: string) { 
                return "translate(" + (-x(d["fn_interval"])) + ",0)"; })
            .attr("width", function(d) {
              return x(d["fn_interval"]); } )
            .attr("y", function(d) { 
              return d["type"] == "1" ? y(d["confidence"]) + y.bandwidth()/3 
                                      : y(d["confidence"]) + y.bandwidth()/1.5; })
            .attr("height", function(d) {
              return y.bandwidth()/3
            })
            .attr("fill", (d)=>d['type'] == '1'? this.selection1Color:this.selection2Color)
            .attr("stroke","black")  
            .on('mouseenter', (d: string) => this.hover = ({type: 'right2', selection: d['type'],classifier: d["classifier"], interval: d["confidence"].toString()}))
            .on('mouseleave', this.clearHover)

          
          barCells
            .append("rect")
            .attr('class', 'bar-middle2')
            .attr("transform", function(d: string) { 
                return "translate(" + (-x(d["fn_interval"])-x(d["mn_interval"])) + ",0)"; })
            .attr("width", function(d) {
              return x(d["mn_interval"]); } )
            .attr("y", function(d) { 
              return d["type"] == "1" ? y(d["confidence"]) + y.bandwidth()/3
                                      : y(d["confidence"]) + y.bandwidth()/1.5; })
            .attr("height", function(d) {
              return y.bandwidth()/3
            })
            .attr("fill", (d)=>d['type'] == '1'? this.selection1Color:this.selection2Color)
            .attr("stroke","black")
            .on('mouseenter', (d: string) => this.hover = ({type: 'middle2', selection: d['type'],classifier: d["classifier"], interval: d["confidence"].toString()}))
            .on('mouseleave', this.clearHover)

        
          barCells
            .append("rect")
            .attr('class', 'bar-wrong2')
            .attr('id',d=>'bar-wrong2-'+d['classifier']+'-'+d['confidence'])
            .attr("transform", function(d: string) { 
                return "translate(" + (-x(d["fn_interval"])-x(d["fp_interval"])-x(d["mn_interval"])) + ",0)"; })
            .attr("width", function(d) {
              return x(d["fp_interval"]); } )
            .attr("y", function(d) { 
              return d["type"] == "1" ? y(d["confidence"]) + y.bandwidth()/3 
                                      : y(d["confidence"]) + y.bandwidth()/1.5; })
            .attr("height", function(d) {
              return y.bandwidth()/3
            })
            .attr("fill", (d)=>d['type'] == '1'? this.selection1Color:this.selection2Color)
            .attr("stroke","black")
            .on('mouseenter', (d: string) => this.hover = ({type: 'wrong2', selection: d['type'],classifier: d["classifier"], interval: d["confidence"].toString()}))
            .on('mouseleave', this.clearHover)

          barCells
            .append("circle")   
            .attr('r',y.bandwidth()/24)
            .attr('class', 'bar-right1-circle')
            .attr("cx",y.bandwidth()/6)
            .attr("cy", function(d) { 
              return y(d["confidence"]) + y.bandwidth()/ 2; })
            .attr("visibility", (d) => x(d["tp_interval"]) < y.bandwidth()/6 && x(d["tp_interval"]) > 0? "visible":"hidden")
            .attr("fill", this.rightColor1)  
            .on('mouseenter', (d: string) => this.hover = ({type: 'right1', classifier: d["classifier"], interval: d["confidence"].toString()}))
            .on('mouseleave', this.clearHover)


          barCells
            .append("circle")   
            .attr('r',y.bandwidth()/24)
            .attr('class', 'bar-middle1-circle')
            .attr("transform", function(d: string) { 
                return "translate(" + (x(d["tp_interval"])) + ",0)"; })
            .attr("cx",y.bandwidth()/6)
            .attr("cy", function(d) { 
              return y(d["confidence"]) + y.bandwidth()/ 2; })
            .attr("visibility", (d) => x(d["mp_interval"]) < y.bandwidth()/6 && x(d["mp_interval"]) > 0? "visible":"hidden")
            .attr("fill", "lightgrey")
            .on('mouseenter', (d: string) => this.hover = ({type: 'middle1', classifier: d["classifier"], interval: d["confidence"].toString()}))
            .on('mouseleave', this.clearHover)
          
          barCells
            .append("circle")   
            .attr('r',y.bandwidth()/24)
            .attr('class', 'bar-wrong1-circle')
            .attr("transform", function(d: string) { 
                return "translate(" + (x(d["tp_interval"]+d["mp_interval"])) + ",0)"; })
            .attr("cx",y.bandwidth()/6)
            .attr("cy", function(d) { 
              return y(d["confidence"]) + y.bandwidth()/ 2; })
            .attr("visibility", (d) =>x(d["tn_interval"]) < y.bandwidth()/6 && x(d["tn_interval"]) > 0? "visible":"hidden")
            .attr("fill", this.wrongColor)
            .on('mouseenter', (d: string) => this.hover = ({type: 'wrong1', classifier: d["classifier"], interval: d["confidence"].toString()}))
            .on('mouseleave', this.clearHover)
                      
          barCells
            .append("circle")   
            .attr('r',y.bandwidth()/24)
            .attr('class', 'bar-right2-circle')
            .attr("cx",-y.bandwidth()/24)
            .attr("cy", function(d) { 
              return y(d["confidence"]) + y.bandwidth()/ 2; })
            .attr("visibility", (d) => x(d["fn_interval"]) < y.bandwidth()/6 && x(d["fn_interval"]) > 0? "visible":"hidden")
            .attr("fill", this.rightColor1)  
            .on('mouseenter', (d: string) => this.hover = ({type: 'right2', classifier: d["classifier"], interval: d["confidence"].toString()}))
            .on('mouseleave', this.clearHover)
            
          barCells
            .append("circle")   
            .attr('r',y.bandwidth()/24)
            .attr('class', 'bar-middle2-circle')
            .attr("transform", function(d: string) { 
                return "translate(" + (-x(d["fn_interval"])-x(d["mn_interval"])) + ",0)"; })
            .attr("cx",-y.bandwidth()/24)
            .attr("cy", function(d) { 
              return y(d["confidence"]) + y.bandwidth()/ 2; })
            .attr("visibility", (d) => x(d["mn_interval"]) < y.bandwidth()/6 && x(d["mn_interval"]) > 0? "visible":"hidden")
            .attr("fill", "lightgrey")  
            .on('mouseenter', (d: string) => this.hover = ({type: 'middle2', classifier: d["classifier"], interval: d["confidence"].toString()}))
            .on('mouseleave', this.clearHover)
                    
          barCells
            .append("circle")   
            .attr('r',y.bandwidth()/24)
            .attr('class', 'bar-wrong2-circle')
            .attr("transform", function(d: string) { 
                return "translate(" + (-x(d["fn_interval"])-x(d["fp_interval"])-x(d["mn_interval"])) + ",0)"; })
            .attr("cx",-y.bandwidth()/24)
            .attr("cy", function(d) { 
              return y(d["confidence"]) + y.bandwidth()/ 2; })
            .attr("visibility", (d) => x(d["fp_interval"]) < y.bandwidth()/6 && x(d["fp_interval"]) > 0? "visible":"hidden")
            .attr("fill", this.wrongColor1)  
            .on('mouseenter', (d: string) => this.hover = ({type: 'wrong2', classifier: d["classifier"], interval: d["confidence"].toString()}))
            .on('mouseleave', this.clearHover)
            
          // Draw the axis:
          svg.selectAll("myAxis")
            .data(classifiers).enter()
            .append("g")
            .style("font", "28px times")
            .style("text-anchor", "end")
            .style("dominant-baseline","ideographic")
            .attr("transform", function(d:string) { return "translate(" + (xAxis(d)) + ")"; })
            .each(function(d:string) { 
              d3.select(this).call(d3.axisLeft<d3.AxisDomain>(yAxis[d]).scale(yAxis[d])); 
              })
          
        })
      };

      
      if (this.selection_mode == 'overall') {
        drawConfidence();
        this.drawSelections();
      } else {
        drawSelectedConfidence();
      }

      function get_confidence_data() {
        let confidenceData = []
        let confidenceDict = {}
        classifiers.forEach((c)=>{
          let ci_tp = predictions[c].ci_tp;
          let ci_tn = predictions[c].ci_tn;
          let ci_fp = predictions[c].ci_fp;
          let ci_fn = predictions[c].ci_fn;
          let ci_mp = predictions[c].ci_mp;
          let ci_mn = predictions[c].ci_mn;
          let curConfidenceData = []
          if (normalization == 'Yes') {
            for (var i in confidence) {
              let confidenceInstanceSizeOne = (ci_tp[i] + ci_fp[i] + ci_mp[i] + ci_tn[i] + ci_fn[i] + ci_mn[i]) / 1.5
              let confidenceInstanceSizeTwo = (ci_tn[i] + ci_fn[i] + ci_mn[i] + ci_tp[i] + ci_fp[i] + ci_mp[i]) / 1.5
              curConfidenceData.push({"classifier":c,"confidence":confidence[i], 
                      "tp_interval":confidenceInstanceSizeOne == 0? 0 : ci_tp[i] * maxIntervals / confidenceInstanceSizeOne, 
                      "fp_interval":confidenceInstanceSizeOne == 0? 0 : ci_fp[i] * maxIntervals / confidenceInstanceSizeOne,
                      "tn_interval":confidenceInstanceSizeTwo == 0? 0 : ci_tn[i] * maxIntervals / confidenceInstanceSizeTwo, 
                      "fn_interval":confidenceInstanceSizeTwo == 0? 0 :ci_fn[i] * maxIntervals / confidenceInstanceSizeTwo,
                      "mp_interval":confidenceInstanceSizeOne == 0? 0 :ci_mp[i] * maxIntervals / confidenceInstanceSizeOne, 
                      "mn_interval":confidenceInstanceSizeTwo == 0? 0 :ci_mn[i] * maxIntervals / confidenceInstanceSizeTwo, 
                      "threshold":predictions[c].threshold})
            }
          } else {
            for (var i in confidence) {
              curConfidenceData.push({"classifier":c,"confidence":confidence[i], "tp_interval":ci_tp[i], "tn_interval":ci_tn[i],"fp_interval":ci_fp[i], "fn_interval":ci_fn[i],"mp_interval":ci_mp[i], "mn_interval":ci_mn[i], "threshold":predictions[c].threshold})
            }
          }
          
          confidenceData.push({"name":c, "data":curConfidenceData,"threshold":predictions[c].threshold})
          confidenceDict[c] = curConfidenceData
        })
        return confidenceData
      };

      function get_selected_confidence_data(select_type) {
        // type == 1 --> left click
        // type == 2 --> right click
        const { first, second } = selections;
        const selection = select_type == '1' ? first.instances : second.instances
        let confidenceData = []
        let confidenceDict = {}
        let maxSelectionSize = 0
        classifiers.forEach((c)=>{
          confidence.forEach((i)=>{
            let ci_tp = intersection(predictions[c]["ci_tp_instances"][i].instances, selection); 
            let ci_tn = intersection(predictions[c]["ci_tn_instances"][i].instances, selection);
            let ci_fp = intersection(predictions[c]["ci_fp_instances"][i].instances, selection);
            let ci_fn = intersection(predictions[c]["ci_fn_instances"][i].instances, selection);
            let ci_mp = intersection(predictions[c]["ci_mp_instances"][i].instances, selection);
            let ci_mn = intersection(predictions[c]["ci_mn_instances"][i].instances, selection);
            maxSelectionSize = d3.max([ci_tp.size, ci_tn.size, ci_fp.size, ci_fn.size, ci_mp.size, ci_mn.size]) > maxSelectionSize ?  d3.max([ci_tp.size, ci_tn.size, ci_fp.size, ci_fn.size, ci_mp.size, ci_mn.size]) : maxSelectionSize;
          })
        })
        classifiers.forEach((c)=>{
          let curConfidenceData = []
          confidence.forEach((i)=>{
            let ci_tp = intersection(predictions[c]["ci_tp_instances"][i].instances, selection); 
            let ci_tn = intersection(predictions[c]["ci_tn_instances"][i].instances, selection);
            let ci_fp = intersection(predictions[c]["ci_fp_instances"][i].instances, selection);
            let ci_fn = intersection(predictions[c]["ci_fn_instances"][i].instances, selection);
            let ci_mp = intersection(predictions[c]["ci_mp_instances"][i].instances, selection);
            let ci_mn = intersection(predictions[c]["ci_mn_instances"][i].instances, selection);
            curConfidenceData.push({"classifier":c,"confidence":i, "type":select_type, "tp_interval":ci_tp.size * maxIntervals / maxSelectionSize, "tn_interval":ci_tn.size * maxIntervals / maxSelectionSize,"fp_interval":ci_fp.size * maxIntervals / maxSelectionSize, "fn_interval":ci_fn.size * maxIntervals / maxSelectionSize,"mp_interval":ci_mp.size * maxIntervals / maxSelectionSize, "mn_interval":ci_mn.size * maxIntervals / maxSelectionSize, "threshold":predictions[c].threshold})
          })
          confidenceData.push({"name":c, "data":curConfidenceData,"threshold":predictions[c].threshold})
        })
        return confidenceData
      };
    },

    drawDistributionLine() {
      const chart = d3.select(this.$refs.svg);
      const svg = chart.select(".svg-confidence");
      svg.selectAll('*').remove();  

      const x = this.x
      const y = this.y    
    
      const classifiers = this.addedBandWidthClassifiers.map((c)=>{
        return c.name
      })

      var xAxis = d3.scalePoint()
          .range([0, this.width])
          .padding(0.5)
          .domain(classifiers);

      const yThreshold = d3.scaleBand<string>()
        .domain(this.confidence)
        .range([this.height,0])


      const drawAxis = () =>{
        var yAxis = {}
        for (var i in classifiers) {
          var name = classifiers[i];
          var lowthreshold = 0;
          yAxis[name] = d3.scaleBand() 
            .range([this.height, 0])
            .domain(this.confidence);
        }
        
        // Draw the axis:
        svg.selectAll("myAxis")
          .data(classifiers).enter()
          .append("g")
          .style("font", "20px times")
          .style("text-anchor", "end")
          .style("dominant-baseline","ideographic")
          .attr("transform", function(d:string) { return "translate(" + (xAxis(d)) + ")"; })
          .each(function(d:string) { 
            d3.select(this).call(d3.axisLeft<d3.AxisDomain>(yAxis[d]).scale(yAxis[d])); 
          })
      };

      const drawLine = () =>{
        let confidence = this.confidence;
        let predictions = this.predictions;
        function line(d) {
              return d3.line()(confidence.map(function(p,j) { 
                return [3 + xAxis(d) + x((predictions[d]['ci_tp'][j]+predictions[d]['ci_tn'][j])), yThreshold.bandwidth() / 2 +  yThreshold(p)]; 
              }));
        }

        classifiers.forEach((d)=>{
            svg.append("path")
              .attr('class', 'line-threshold')
              .attr("d",  line(d))
              .style("fill", "none")
              .attr("stroke", 'steelblue')
              .style("stroke-width", 3)
              .style("opacity", 1)   
        })
      };

      const drawLegends = () =>{
        const legend = svg
          .append('g')
            .attr('class', 'legend')
            .attr('transform', 
             `translate(
              ${this.width },
              ${this.height*4})`
            
            );

          svg.append('rect')
            .attr('transform', `translate(${this.width - 60}, ${- this.margin.top * 2})`)
            .attr('width', 120)
            .attr('height', 2)
            .attr('fill', 'steelblue')    
          
            
          svg.append('text')
            .attr('transform', `translate(${this.width - 120}, ${- this.margin.top * 2})`)
            .attr('font-size', '20px')
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'middle')
            .text( "correctness") 
      };

      drawAxis();
      drawLine();
      drawLegends();
      
    

      

      
    },

    drawOriginalDistribution() {
      d3.select(this.$refs.svg).selectAll('*').remove();

      const svg = d3.select(this.$refs.svg).append('svg')
        .attr("class","svg-all")
        .attr('width', '100%')
        .attr('viewBox', `0 0
          ${this.width + this.margin.left + this.margin.right}
          ${this.height + this.margin.top * 2 + this.margin.bottom}`)
        .append('g')
          .attr("class","svg-confidence")
          .attr('transform', `translate(${this.margin.left/4}, ${this.margin.bottom})`);
      const x = this.x
      const y = this.y    
      
      const classifiers = this.classifiers

      const xAxis = d3.scalePoint()
          .range([0, this.width])
          .padding(0.5)
          .domain(this.classifiers);
      
      var yAxis = {}
      for (var i in classifiers) {
          var name = classifiers[i];
          var lowthreshold = 0;
          yAxis[name] = d3.scaleBand() 
            .range([this.height, 0])
            .domain(this.confidence);
      }

      const width = this.width;
      const height = this.height
      const maxIntervals = this.maxIntervals

      let confidenceData = []
      let confidenceDict = {}
      this.classifiers.forEach((c)=>{
        let ci_pred = this.predictions[c].ci_pred;
        let curConfidenceData = []
        for (var i in this.confidence) {
          if (this.normalization == 'Yes') {
            curConfidenceData.push({"classifier":c,"confidence":this.confidence[i], "pred_interval":ci_pred[i] == 0? 0 : maxIntervals, "threshold":this.predictions[c].threshold})
          } else {
            curConfidenceData.push({"classifier":c,"confidence":this.confidence[i], "pred_interval":ci_pred[i],"threshold":this.predictions[c].threshold})
          }
        }
        confidenceData.push({"name":c, "data":curConfidenceData,"threshold":this.predictions[c].threshold})
        confidenceDict[c] = curConfidenceData
      })

      const barCells =  svg.append("g").selectAll("g")
          .data(classifiers)
          .enter().append("g")
            .attr("transform", function(d: string) { 
              return "translate(" + xAxis(d) + ",0)"; })
          .selectAll("rect")
            .data((d:string)=> { 
            return confidenceDict[d]; })
            .enter()
      
      const drawDistributionAxis = () => {
        svg.selectAll("myAxis")
          .data(classifiers).enter()
          .append("g")
          .style("font", "28px times")
          .style("text-anchor", "end")
          .style("dominant-baseline","ideographic")
          .attr("transform", function(d:string) { return "translate(" + (xAxis(d)) + ")"; })
          .each(function(d:string) { 
            d3.select(this).call(d3.axisLeft<d3.AxisDomain>(yAxis[d]).scale(yAxis[d])); 
          });
      };
      
      const drawTitles = () => {
        let classifiers = this.classifiers
        svg.selectAll("myText")
          .data(classifiers)
          .enter().append("text")
              .style("text-anchor", "middle")
              .attr("transform", function(d: string) { 
              return "translate(" + xAxis(d) + ","+(height+25)+")"; })
              .text((d:string)=>{
                return d})
              .style("fill", "black")
              .style("font-size", "30px");
      };
      
      const drawLegend = () => {
        const width = this.width / 8;
        const height = this.margin.top / 1.5;

        const legend = svg
          .append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(
              ${this.width},
              ${-height*4})`);

        legend.append('rect')
          .attr('width', width)
          .attr('height', height*2)
          .attr('fill', this.rightColor);

        legend.append('text')
          .attr('transform', `translate(${width / 2}, ${height})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text("prediction");  
         
      };

      const drawDistributionBar = () => {
        barCells
          .append("rect")
          .attr('class', 'bar-original')
          .attr("width", function(d) {
             return x(d["pred_interval"]); } )
          .attr("y", function(d) { 
            return y(d["confidence"]); })
          .attr("height", function(d) {
            return y.bandwidth()
          })
          .attr("fill",this.rightColor)
          .on('mouseenter', (d: string) => this.hover_distribution = ({type: 'dist', classifier: d["classifier"], interval: d["confidence"].toString()}))
          .on('mouseleave', this.clearDistributionHover)
          .on('click', (d: string) => this.select(d["classifier"], 'dist', 'first',d["confidence"].toString()))
          .on('contextmenu', (d: string) => this.select(d["classifier"], 'dist', 'second',d["confidence"].toString()));
        
        barCells
          .append("circle")   
          .attr('class', 'circle-original')
          .attr('cy', function(d) { 
            return y(d["confidence"]) + y.bandwidth()/2; })
          .attr('cx', y.bandwidth()/6)
          .attr('r',y.bandwidth()/6)
          .style('fill', this.rightColor)
          .attr("visibility",function(d) {
             return x(d["pred_interval"]) < y.bandwidth() / 3 && d["pred_interval"] > 0 ? "visible" : "hidden"; } )
            

        const selections = () => {
          const selectionBarWidth = y.bandwidth() / 4;
          const selectionColors  = [this.selection1Color, this.selection2Color];

          selectionColors.forEach((color, index)=>{
            barCells.append('rect')
              .attr('class', 'bar-original-selection-' + (index+1))
              .attr('y',function(d){
                return y(d["confidence"]) + 0.5 * y.bandwidth() - selectionBarWidth + selectionBarWidth * index
                })
              .attr('height', selectionBarWidth)
              .attr('fill', color)
              .attr('stroke', 'black')
              .attr('stroke-width', '1px')
              .attr('pointer-events', 'none')
            
            barCells.append("circle")   
              .attr('class', 'circle-pred-selection-' + (index+1))
              .attr('cy', function(d){
                return y(d["confidence"]) + 0.5 * y.bandwidth()- selectionBarWidth/2 + selectionBarWidth * index 
                })
              .attr("cx",selectionBarWidth/2)
              .attr('r', selectionBarWidth / 2)
              .style('fill', color)
              .attr("visibility","hidden")
          })
        };
        selections();    
      };

      const yAxisMarkerLine = () => {
        svg.append('line')
          .attr('class', 'y-axis-marker-line-dist')
          .attr('x1', x(0))
          .attr('y1',0)
          .attr('x2', x(0))
          .attr('y2', this.height*1.2)
          .attr('stroke', 'black')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr('pointer-events', 'none');
      };

      const yAxisMarkerText = () => {
        svg.append("rect")
          .attr('class', 'y-axis-marker-rect-dist')
          .attr("width",120)
          .attr("height",60)
          .attr("fill","white")
          .attr("stroke","grey")
          .attr("y",-60)
          .attr('opacity', 0);

        svg.append('text')
          .attr('class', 'y-axis-marker-text-pred')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', this.rightHoverColor)
          .attr('pointer-events', 'hanging');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-pred-s1')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', 'steelblue')
          .attr('pointer-events', 'hanging');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-pred-s2')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', 'red')
          .attr('pointer-events', 'hanging');
      };

      drawLegend();
      drawTitles();
      drawDistributionAxis();
      drawDistributionBar();
      yAxisMarkerLine();
      yAxisMarkerText();
      this.drawDistSelections();
      this.drawDistributionHover();
    },

    drawDistSelections() {
      const chart = d3.select(this.$refs.svg);
      const y = this.y
      const selectionBarWidth = y.bandwidth() / 4;
      const barPredSelection1 = chart.selectAll('.bar-original-selection-1');
      const barPredSelection2 = chart.selectAll('.bar-original-selection-2');
      const circlePredSelection1 = chart.selectAll('.circle-pred-selection-1');
      const circlePredSelection2 = chart.selectAll('.circle-pred-selection-2');
      const yAxisMarkerTextRect_s1 = chart.selectAll('.y-axis-marker-text-pred-s1');
      const yAxisMarkerTextRect_s2 = chart.selectAll('.y-axis-marker-text-pred-s2');
      const formatDecimal = d3.format(".1f")
      const maxIntervals = this.maxIntervals
      const normalization = this.normalization
      const x = this.x;

      const { first, second } = this.selections;

      
      const rightHeight = (classifierName:string, confidence:string, selection: Set<string>, type) => {
        const instances = new Set([...this.predictions[classifierName]["ci_tp_instances"][confidence].instances
                                  , ...this.predictions[classifierName]["ci_fn_instances"][confidence].instances
                                  , ...this.predictions[classifierName]["ci_tn_instances"][confidence].instances
                                  , ...this.predictions[classifierName]["ci_fp_instances"][confidence].instances
                                  , ...this.predictions[classifierName]["ci_mn_instances"][confidence].instances
                                  , ...this.predictions[classifierName]["ci_mp_instances"][confidence].instances
                                  ]);
        var totalInstances = 0
        totalInstances = this.instances.length
        const overlappingInstances = intersection(instances, selection);
        const fractionOfTotalInstances = normalization !='Yes'? overlappingInstances.size : instances.size == 0? 0 : overlappingInstances.size * maxIntervals / instances.size;  /// totalInstances;
        return this.x(fractionOfTotalInstances);
      };


      const rightOverLap = (classifierName:string,confidence:string, selection: Set<string>,type) => {
        const instances = new Set([...this.predictions[classifierName]["ci_tp_instances"][confidence].instances
                                  , ...this.predictions[classifierName]["ci_fn_instances"][confidence].instances
                                  , ...this.predictions[classifierName]["ci_tn_instances"][confidence].instances
                                  , ...this.predictions[classifierName]["ci_fp_instances"][confidence].instances
                                  , ...this.predictions[classifierName]["ci_mn_instances"][confidence].instances
                                  , ...this.predictions[classifierName]["ci_mp_instances"][confidence].instances
                                  ]);
        var totalInstances = 0
        totalInstances = this.instances.length
        const overlappingInstances = intersection(instances, selection);
        const fractionOfTotalInstances = normalization !='Yes'? overlappingInstances.size : instances.size == 0? 0 : overlappingInstances.size * maxIntervals / instances.size /// totalInstances;
        return fractionOfTotalInstances;
      };


      var xAxis = d3.scalePoint()
          .range([0, this.width])
          .padding(0.5)
          .domain(this.classifiers);

      if (!first) {
        barPredSelection1.attr('width', '0');
        circlePredSelection1.attr("visibility","hidden");
      } else {
        if (this.hover_distribution.type) {
          yAxisMarkerTextRect_s1
              .attr('fill-opacity', 1)
              .attr("fill","steelblue")
              .attr("transform",  "translate(" + (xAxis(this.hover_distribution.classifier)) + ",-40)" )
              .text("1st: "+rightOverLap(this.hover_distribution.classifier,this.hover_distribution.interval, first.instances, 1));
        }
           
        barPredSelection1
          .attr('width', (d: string) => rightHeight(d["classifier"], d["confidence"], first.instances, 1));
        circlePredSelection1
          .attr("visibility",(d: string) => rightHeight(d["classifier"], d["confidence"], first.instances, 1) 
            > selectionBarWidth * 2
            || rightHeight(d["classifier"], d["confidence"], first.instances, 1)  <= 0? "hidden" :"visible")
        }

                  

      if (!second) {
        barPredSelection2.attr('width', '0');
        circlePredSelection2.attr("visibility","hidden");
      } else {
        if (this.hover_distribution.type) {
          yAxisMarkerTextRect_s2
                .attr('fill-opacity', 1)
                .attr("fill","red")
                .attr("transform",  "translate(" + (xAxis(this.hover_distribution.classifier)) + ",-25)" )
                .text("2nd: "+rightOverLap(this.hover_distribution.classifier,this.hover_distribution.interval, second.instances, 1));
          }
          
        barPredSelection2
          .attr('width', (d: string) => rightHeight(d["classifier"], d["confidence"], second.instances, 1));
        circlePredSelection2
          .attr("visibility",(d: string) => rightHeight(d["classifier"], d["confidence"], second.instances, 1) 
            > selectionBarWidth * 2
            || rightHeight(d["classifier"], d["confidence"], second.instances, 1)  <= 0? "hidden" :"visible")
      }
    },

    drawSelections() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      const y = this.y
      const selectionBarWidth = y.bandwidth() / 4;
      const barRightSelection1 = chart.selectAll('.bar-right-selection-1');
      const barRightSelection2 = chart.selectAll('.bar-right-selection-2');
      const barWrongSelection1 = chart.selectAll('.bar-wrong-selection-1');
      const barWrongSelection2 = chart.selectAll('.bar-wrong-selection-2');
      const barMiddleSelection1 = chart.selectAll('.bar-middle-selection-1');
      const barMiddleSelection2 = chart.selectAll('.bar-middle-selection-2');

      const barRight2Selection1 = chart.selectAll('.bar-right2-selection-1');
      const barRight2Selection2 = chart.selectAll('.bar-right2-selection-2');
      const barWrong2Selection1 = chart.selectAll('.bar-wrong2-selection-1');
      const barWrong2Selection2 = chart.selectAll('.bar-wrong2-selection-2');
      const barMiddle2Selection1 = chart.selectAll('.bar-middle2-selection-1');
      const barMiddle2Selection2 = chart.selectAll('.bar-middle2-selection-2');

      const circleRightSelection1 = chart.selectAll('.circle-right-selection-1');
      const circleRightSelection2 = chart.selectAll('.circle-right-selection-2');
      const circleWrongSelection1 = chart.selectAll('.circle-wrong-selection-1');
      const circleWrongSelection2 = chart.selectAll('.circle-wrong-selection-2');
      const circleMiddleSelection1 = chart.selectAll('.circle-middle-selection-1');
      const circleMiddleSelection2 = chart.selectAll('.circle-middle-selection-2');

      const circleRight2Selection1 = chart.selectAll('.circle-right2-selection-1');
      const circleRight2Selection2 = chart.selectAll('.circle-right2-selection-2');
      const circleWrong2Selection1 = chart.selectAll('.circle-wrong2-selection-1');
      const circleWrong2Selection2 = chart.selectAll('.circle-wrong2-selection-2');
      const circleMiddle2Selection1 = chart.selectAll('.circle-middle2-selection-1');
      const circleMiddle2Selection2 = chart.selectAll('.circle-middle2-selection-2');

      const yAxisMarkerTextRight_s1 = chart.select('.y-axis-marker-text-right1-s1');
      const yAxisMarkerTextWrong_s1 = chart.select('.y-axis-marker-text-wrong1-s1');
      const yAxisMarkerTextMiddle_s1 = chart.select('.y-axis-marker-text-middle1-s1');
      const yAxisMarkerTextRight_s2 = chart.select('.y-axis-marker-text-right1-s2');
      const yAxisMarkerTextWrong_s2 = chart.select('.y-axis-marker-text-wrong1-s2');
      const yAxisMarkerTextMiddle_s2 = chart.select('.y-axis-marker-text-middle1-s2');
      const hoverRect = chart.select(".y-axis-marker-rect")


      const formatDecimal = d3.format(".1f")
      const x = this.x;

      const { first, second } = this.selections;
      const rightYOffset = (classifierName:string,confidence:string, selection: Set<string>,type) => {
        const instances = type==1? this.predictions[classifierName]["ci_tp_instances"][confidence].instances
                                  :this.predictions[classifierName]["ci_tn_instances"][confidence].instances
        var totalInstances = 0
        totalInstances = this.instances.length
        const overlappingInstances = intersection(instances, selection);
        const confidenceInstancesSize = (this.predictions[classifierName]["ci_tp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mp_instances"][confidence].instances.size)
                                  + (this.predictions[classifierName]["ci_tn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mn_instances"][confidence].instances.size)

        // type==1? (this.predictions[classifierName]["ci_tp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mp_instances"][confidence].instances.size)
        //                           :(this.predictions[classifierName]["ci_tn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mn_instances"][confidence].instances.size)


        const fractionOfTotalInstances = this.normalization == 'No' ? overlappingInstances.size 
                                      :instances.size == 0 ? 0 : overlappingInstances.size * this.maxIntervals / (confidenceInstancesSize / 1.5);

        return this.x(fractionOfTotalInstances);
      };
      const rightHeight = (classifierName:string, confidence:string, selection: Set<string>, type) => {
        return rightYOffset(classifierName,confidence, selection,type);
      };

      const wrongHeight = (classifierName:string, confidence:string, selection: Set<string>, type) => {
        const instances = type == 1? this.predictions[classifierName]["ci_fp_instances"][confidence].instances
                                    :this.predictions[classifierName]["ci_fn_instances"][confidence].instances
        var totalInstances = 0
        totalInstances = this.instances.length
        const overlappingInstances = intersection(instances, selection);
        const confidenceInstancesSize = (this.predictions[classifierName]["ci_tp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mp_instances"][confidence].instances.size)
                                  + (this.predictions[classifierName]["ci_tn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mn_instances"][confidence].instances.size)

        // type==1? (this.predictions[classifierName]["ci_tp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mp_instances"][confidence].instances.size)
        //                           :(this.predictions[classifierName]["ci_tn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mn_instances"][confidence].instances.size)


        const fractionOfTotalInstances = this.normalization == 'No' ? overlappingInstances.size 
                                      :instances.size == 0 ? 0 : overlappingInstances.size * this.maxIntervals / (confidenceInstancesSize / 1.5);
                                      
        return  this.x(fractionOfTotalInstances);
      };

      const middleHeight = (classifierName:string, confidence:string, selection: Set<string>, type) => {
        const instances = type == 1? this.predictions[classifierName]["ci_mp_instances"][confidence].instances
                                    :this.predictions[classifierName]["ci_mn_instances"][confidence].instances
        var totalInstances = 0
        totalInstances = this.instances.length
        const overlappingInstances = intersection(instances, selection);
        const confidenceInstancesSize = (this.predictions[classifierName]["ci_tp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mp_instances"][confidence].instances.size)
                                  + (this.predictions[classifierName]["ci_tn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mn_instances"][confidence].instances.size)

        // type==1? (this.predictions[classifierName]["ci_tp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mp_instances"][confidence].instances.size)
        //                           :(this.predictions[classifierName]["ci_tn_instances"][confidence].instances.size+ this.predictions[classifierName]["ci_fn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mn_instances"][confidence].instances.size)


        const fractionOfTotalInstances = this.normalization == 'No' ? overlappingInstances.size 
                                      :instances.size == 0 ? 0 : overlappingInstances.size * this.maxIntervals / (confidenceInstancesSize / 1.5);

        return  this.x(fractionOfTotalInstances);
      };

      const rightOverLap = (classifierName:string,confidence:string, selection: Set<string>,type) => {
        const instances = type==1? this.predictions[classifierName]["ci_tp_instances"][confidence].instances
                                  :this.predictions[classifierName]["ci_tn_instances"][confidence].instances
        var totalInstances = 0
        totalInstances = this.instances.length
        const overlappingInstances = intersection(instances, selection);
        const confidenceInstancesSize = (this.predictions[classifierName]["ci_tp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mp_instances"][confidence].instances.size)
                                  + (this.predictions[classifierName]["ci_tn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mn_instances"][confidence].instances.size)

        // type==1? (this.predictions[classifierName]["ci_tp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mp_instances"][confidence].instances.size)
        //                           :(this.predictions[classifierName]["ci_tn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mn_instances"][confidence].instances.size)


        const fractionOfTotalInstances = this.normalization == 'No' ? overlappingInstances.size 
                                      :instances.size == 0 ? 0 : overlappingInstances.size * this.maxIntervals / (confidenceInstancesSize / 1.5);
        return fractionOfTotalInstances;
      };

      const wrongOverLap = (classifierName:string, confidence:string, selection: Set<string>, type) => {
        const instances = type == 1? this.predictions[classifierName]["ci_fp_instances"][confidence].instances
                                    :this.predictions[classifierName]["ci_fn_instances"][confidence].instances

        var totalInstances = 0
        totalInstances = this.instances.length
        const overlappingInstances = intersection(instances, selection);
        const confidenceInstancesSize = (this.predictions[classifierName]["ci_tp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mp_instances"][confidence].instances.size)
                                  + (this.predictions[classifierName]["ci_tn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mn_instances"][confidence].instances.size)

        // type==1? (this.predictions[classifierName]["ci_tp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mp_instances"][confidence].instances.size)
        //                           :(this.predictions[classifierName]["ci_tn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mn_instances"][confidence].instances.size)
        const fractionOfTotalInstances = this.normalization == 'No' ? overlappingInstances.size 
                                      :instances.size == 0 ? 0 : overlappingInstances.size * this.maxIntervals / (confidenceInstancesSize / 1.5);;
        return fractionOfTotalInstances;
      };

      const middleOverLap = (classifierName:string, confidence:string, selection: Set<string>, type) => {
        const instances = type == 1? this.predictions[classifierName]["ci_mp_instances"][confidence].instances
                                    :this.predictions[classifierName]["ci_mn_instances"][confidence].instances
        var totalInstances = 0
        totalInstances = this.instances.length
        const overlappingInstances = intersection(instances, selection);
        const confidenceInstancesSize = (this.predictions[classifierName]["ci_tp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mp_instances"][confidence].instances.size)
                                  + (this.predictions[classifierName]["ci_tn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mn_instances"][confidence].instances.size)

        // type==1? (this.predictions[classifierName]["ci_tp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fp_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mp_instances"][confidence].instances.size)
        //                           :(this.predictions[classifierName]["ci_tn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_fn_instances"][confidence].instances.size + this.predictions[classifierName]["ci_mn_instances"][confidence].instances.size)

        const fractionOfTotalInstances = this.normalization == 'No' ? overlappingInstances.size 
                                      :instances.size == 0 ? 0 : overlappingInstances.size * this.maxIntervals / (confidenceInstancesSize / 1.5);
        return  fractionOfTotalInstances;
      };

      var xAxis = d3.scalePoint()
          .range([0, this.width])
          .padding(0.5)
          .domain(this.classifiers);
      
      if (!first) {
        barRightSelection1.attr('width', '0');
        barWrongSelection1.attr('width', '0');
        barMiddleSelection1.attr('width', '0');

        barRight2Selection1.attr('width', '0');
        barWrong2Selection1.attr('width', '0');
        barMiddle2Selection1.attr('width', '0');

        circleRightSelection1.attr("visibility","hidden");
        circleWrongSelection1.attr("visibility","hidden");
        circleMiddleSelection1.attr("visibility","hidden");

        circleRight2Selection1.attr("visibility","hidden");
        circleWrong2Selection1.attr("visibility","hidden");
        circleMiddle2Selection1.attr("visibility","hidden");
      } else {
        if (this.hover.type == "right1" || this.hover.type == "wrong1" || this.hover.type == "middle1") {
          yAxisMarkerTextRight_s1
              .attr('fill-opacity', 1)
              .attr("fill","steelblue")
              .attr("transform",  "translate(" + (xAxis(this.hover.classifier)-10) + ",-60)" )
              .text("1st: "+ this.normalization == 'Yes'? '(%)' : '' +rightOverLap(this.hover.classifier,this.hover.interval, first.instances, 1));

          yAxisMarkerTextMiddle_s1
                .attr('fill-opacity', 1) 
                .attr("fill","steelblue")
                .attr("transform",  "translate(" + (xAxis(this.hover.classifier)-10) + ",-40)" )
                .text("1st: "+ this.normalization == 'Yes'? '(%)' : ''+middleOverLap(this.hover.classifier,this.hover.interval, first.instances, 1));
    
          yAxisMarkerTextWrong_s1
                .attr("fill","steelblue")
                .attr('fill-opacity', 1)  
                .attr("transform",  "translate(" + (xAxis(this.hover.classifier)-10) + ",-20)" )
                .text("1st: "+ this.normalization == 'Yes'? '(%)' : ''+wrongOverLap(this.hover.classifier,this.hover.interval, first.instances, 1));
        } else if (this.hover.type == "right2" || this.hover.type == "wrong2" || this.hover.type == "middle2"){
          yAxisMarkerTextRight_s1
              .attr('fill-opacity', 1)
              .attr("fill","steelblue")
              .attr("transform",  "translate(" + (xAxis(this.hover.classifier)-10) + ",-60)" )
              .text("1st: "+ this.normalization == 'Yes'? '(%)' : ''+rightOverLap(this.hover.classifier,this.hover.interval, first.instances, 2));

          yAxisMarkerTextMiddle_s1
                .attr('fill-opacity', 1) 
                .attr("fill","steelblue")
                .attr("transform",  "translate(" + (xAxis(this.hover.classifier)-10) + ",-40)" )
                .text("1st: "+ this.normalization == 'Yes'? '(%)' : ''+middleOverLap(this.hover.classifier,this.hover.interval, first.instances, 2));
    
          yAxisMarkerTextWrong_s1
                .attr("fill","steelblue")
                .attr('fill-opacity', 1)  
                .attr("transform",  "translate(" + (xAxis(this.hover.classifier)-10) + ",-20)" )
                .text("1st: "+ this.normalization == 'Yes'? '(%)' : ''+wrongOverLap(this.hover.classifier,this.hover.interval, first.instances, 2));
        }
        

        barRightSelection1
          .attr('width', (d: string) => rightHeight(d["classifier"], d["confidence"], first.instances, 1));
        barWrongSelection1
          .attr('width', (d: string) => wrongHeight(d["classifier"], d["confidence"], first.instances, 1));
        barMiddleSelection1
          .attr('width', (d: string) => middleHeight(d["classifier"], d["confidence"], first.instances, 1));

        barRight2Selection1
          // .attr("x",(d: string) => -rightHeight(d["classifier"], d["confidence"], first.instances,2))
          .attr('width', (d: string) => rightHeight(d["classifier"], d["confidence"], first.instances,2));
        barWrong2Selection1
          // .attr('x', (d: string) => -wrongHeight(d["classifier"], d["confidence"], first.instances, 2))
          .attr('width', (d: string) => wrongHeight(d["classifier"], d["confidence"], first.instances, 2));
        barMiddle2Selection1
          // .attr('x', (d: string) => -middleHeight(d["classifier"], d["confidence"], first.instances, 2))
          .attr('width', (d: string) => middleHeight(d["classifier"], d["confidence"], first.instances, 2));

        circleRightSelection1
          .attr("visibility",(d: string) => rightHeight(d["classifier"], d["confidence"], first.instances, 1) 
            > selectionBarWidth * 2
            || rightHeight(d["classifier"], d["confidence"], first.instances, 1)  <= 0? "hidden" :"visible")
        circleWrongSelection1
          .attr("visibility",(d: string) => wrongHeight(d["classifier"], d["confidence"], first.instances, 1)
            > selectionBarWidth * 2
            || wrongHeight(d["classifier"], d["confidence"], first.instances, 1) <= 0? "hidden" :"visible")
        circleMiddleSelection1
          .attr("visibility",(d: string) => middleHeight(d["classifier"], d["confidence"], first.instances, 1)
            > selectionBarWidth * 2
            || middleHeight(d["classifier"], d["confidence"], first.instances, 1) <= 0? "hidden" :"visible")

        circleRight2Selection1
          .attr("visibility",(d: string) =>  rightHeight(d["classifier"], d["confidence"], first.instances,2)
            > selectionBarWidth * 2
            || rightHeight(d["classifier"], d["confidence"], first.instances,2) <= 0? "hidden" :"visible")
        circleWrong2Selection1
          .attr("visibility",(d: string) =>  wrongHeight(d["classifier"], d["confidence"], first.instances, 2)
            > selectionBarWidth * 2
            || wrongHeight(d["classifier"], d["confidence"], first.instances, 2) <= 0? "hidden" :"visible")
        circleMiddle2Selection1
          .attr("visibility",(d: string) =>  middleHeight(d["classifier"], d["confidence"], first.instances, 2)
            > selectionBarWidth * 2
            || middleHeight(d["classifier"], d["confidence"], first.instances, 2) <= 0? "hidden" :"visible")

        }

                  

      if (!second) {
        barRightSelection2.attr('width', '0');
        barWrongSelection2.attr('width', '0');
        barMiddleSelection2.attr('width', '0');

        barRight2Selection2.attr('width', '0');
        barWrong2Selection2.attr('width', '0');
        barMiddle2Selection2.attr('width', '0');

        circleRightSelection2.attr("visibility","hidden");
        circleWrongSelection2.attr("visibility","hidden");
        circleMiddleSelection2.attr("visibility","hidden");

        circleRight2Selection2.attr("visibility","hidden");
        circleWrong2Selection2.attr("visibility","hidden");
        circleMiddle2Selection2.attr("visibility","hidden");
      } else {
        if (this.hover.type == "right1" || this.hover.type == "wrong1" || this.hover.type == "middle1"){
          yAxisMarkerTextRight_s2
              .attr('fill-opacity', 1)
              .attr("fill","red")
              .attr("transform",  "translate(" + (xAxis(this.hover.classifier)+60) + ",-60)" )
              .text("2nd: "+ this.normalization == 'Yes'? '(%)' : ''+rightOverLap(this.hover.classifier,this.hover.interval, second.instances, 1));

          yAxisMarkerTextMiddle_s2
                .attr('fill-opacity', 1) 
                .attr("fill","red")
                .attr("transform",  "translate(" + (xAxis(this.hover.classifier)+60) + ",-40)" )
                .text("2nd: "+ this.normalization == 'Yes'? '(%)' : ''+middleOverLap(this.hover.classifier,this.hover.interval, second.instances, 1));
    
          yAxisMarkerTextWrong_s2
                .attr("fill","red")
                .attr('fill-opacity', 1)  
                .attr("transform",  "translate(" + (xAxis(this.hover.classifier)+60) + ",-20)" )
                .text("2nd: "+ this.normalization == 'Yes'? '(%)' : ''+wrongOverLap(this.hover.classifier,this.hover.interval, second.instances, 1));
        } else if (this.hover.type == "right2" || this.hover.type == "wrong2" || this.hover.type == "middle2"){
          yAxisMarkerTextRight_s2
              .attr('fill-opacity', 1)
              .attr("fill","red")
              .attr("transform",  "translate(" + (xAxis(this.hover.classifier)+60) + ",-60)" )
              .text("2nd: "+ this.normalization == 'Yes'? '(%)' : ''+rightOverLap(this.hover.classifier,this.hover.interval, second.instances, 2));

          yAxisMarkerTextMiddle_s2
                .attr('fill-opacity', 1) 
                .attr("fill","red")
                .attr("transform",  "translate(" + (xAxis(this.hover.classifier)+60) + ",-40)" )
                .text("2nd: "+ this.normalization == 'Yes'? '(%)' : ''+middleOverLap(this.hover.classifier,this.hover.interval, second.instances, 2));
    
          yAxisMarkerTextWrong_s2
                .attr("fill","red")
                .attr('fill-opacity', 1)  
                .attr("transform",  "translate(" + (xAxis(this.hover.classifier)+60) + ",-20)" )
                .text("2nd: "+ this.normalization == 'Yes'? '(%)' : ''+wrongOverLap(this.hover.classifier,this.hover.interval, second.instances, 2));
        }
        barRightSelection2
        .attr('width', (d: string) => rightHeight(d["classifier"], d["confidence"], second.instances,1));
        barWrongSelection2
          .attr('width', (d: string) => wrongHeight(d["classifier"], d["confidence"],second.instances,1));
        barMiddleSelection2
          .attr('width', (d: string) => middleHeight(d["classifier"], d["confidence"], second.instances, 1));


        barRight2Selection2
          // .attr('x', (d: string) => -rightHeight(d["classifier"], d["confidence"], second.instances,2))
          .attr('width', (d: string) => rightHeight(d["classifier"], d["confidence"], second.instances,2));
        barWrong2Selection2
          // .attr('x', (d: string) => -wrongHeight(d["classifier"], d["confidence"], second.instances, 2))
          .attr('width', (d: string) => wrongHeight(d["classifier"], d["confidence"], second.instances, 2));
        barMiddle2Selection2
          // .attr('x', (d: string) => -middleHeight(d["classifier"], d["confidence"], second.instances, 2))
          .attr('width', (d: string) => middleHeight(d["classifier"], d["confidence"], second.instances, 2));


        circleRightSelection2
          .attr("visibility",(d: string) => rightHeight(d["classifier"], d["confidence"], second.instances,1)
            > selectionBarWidth * 2
            || rightHeight(d["classifier"], d["confidence"], second.instances,1) <= 0 ? "hidden" :"visible")
        circleWrongSelection2
          .attr("visibility",(d: string) => wrongHeight(d["classifier"], d["confidence"], second.instances, 1)
            > selectionBarWidth * 2 
            ||  wrongHeight(d["classifier"], d["confidence"], second.instances, 1) <= 0? "hidden" :"visible")
        circleMiddleSelection2
          .attr("visibility",(d: string) => middleHeight(d["classifier"], d["confidence"], second.instances, 1)
            > selectionBarWidth * 2 
            || middleHeight(d["classifier"], d["confidence"], second.instances, 1) <= 0? "hidden" :"visible")

        
        circleRight2Selection2
          .attr("visibility",(d: string) =>  rightHeight(d["classifier"], d["confidence"], second.instances,2)
            > selectionBarWidth * 2
            || rightHeight(d["classifier"], d["confidence"], second.instances,2) <= 0 ? "hidden" :"visible")
          // .attr("x",(d: string) => -rightHeight(d["classifier"], d["confidence"], first.instances,2))
        circleWrong2Selection2
          .attr("visibility",(d: string) =>  wrongHeight(d["classifier"], d["confidence"], second.instances, 2)
            > selectionBarWidth * 2 
            || wrongHeight(d["classifier"], d["confidence"], second.instances, 2) <= 0? "hidden" :"visible")
        circleMiddle2Selection2
          .attr("visibility",(d: string) =>  middleHeight(d["classifier"], d["confidence"], second.instances, 2)
            > selectionBarWidth * 2 
            || middleHeight(d["classifier"], d["confidence"], second.instances, 2) <= 0? "hidden" :"visible")

      }
    },
    select(
      classifier: string,
      type: 'right' | 'wrong' | 'right2' | 'wrong2'| 'middle' | 'middle2' | 'dist',
      whichOverlap: 'first' | 'second',
      interval:string,
    ) {
      d3.event.preventDefault();
      d3.event.stopPropagation();

      const constraint = blankConstraint();
      constraint.rule = Rule.RIGHT;
      constraint.classifier = classifier;
      constraint.negation = (type === 'wrong');

      let instances = new Set();
      if (type != 'dist') {
        const curType = type=="right"? "ci_tp_instances"
                        :type=="right2"?"ci_tn_instances"
                        :type=="wrong"?"ci_fp_instances"
                        :type=="wrong2"? "ci_fn_instances"
                        :type=="middle"? "ci_mp_instances"
                        :"ci_mn_instances"
        instances = this.predictions[classifier][curType][interval].instances//this.predictions[classifier][curType];
      } else {
        instances = new Set([...this.predictions[classifier]["ci_tp_instances"][interval].instances
                                  , ...this.predictions[classifier]["ci_fn_instances"][interval].instances
                                  , ...this.predictions[classifier]["ci_tn_instances"][interval].instances
                                  , ...this.predictions[classifier]["ci_fp_instances"][interval].instances
                                  , ...this.predictions[classifier]["ci_mn_instances"][interval].instances
                                  , ...this.predictions[classifier]["ci_mp_instances"][interval].instances
                                  ]);
      }
                  
      const interval_index = this.confidenceIndex[interval]
      const lower_confi = parseFloat(interval) - 0.05 < 0 ? 0 : parseFloat(interval) - 0.05;
      const upper_confi = parseFloat(interval) + 0.05 > 1 ? 1 : parseFloat(interval) + 0.05;
      const description = `Instances which ${classifier} got ${type} with scores between ${lower_confi.toFixed(2)} and  ${upper_confi.toFixed(2)}`;
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

.card {
  background-color: white;
}


  
</style>
