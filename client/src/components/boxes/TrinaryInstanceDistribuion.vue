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
            <span>(Trinary) Instance Distribuion</span>
          </div>
        </v-expansion-panel-header>
        <v-expansion-panel-content>
          <div style="margin: 0px 30px;">
            <v-radio-group v-model="selection_mode" label="Selection Mode">
              <v-radio label="overall confidence " value="overall"></v-radio>
              <v-radio label="selection confidence" value="selected"></v-radio>
            </v-radio-group>
          </div>
          <div style="margin: 0px 30px;">
            <v-radio-group v-model="distribution_mode" label="Distribution Mode">
              <v-radio label="by score " value="score"></v-radio>
              <v-radio label="by correctness" value="correctness"></v-radio>
            </v-radio-group>
          </div>
          <div style="margin: 0px 30px;">
          <v-radio-group v-model="weightedPerformance" label="Performance Type">
            <v-radio label="normal" value="normal"></v-radio>
            <v-radio label="weighted" value="weighted"></v-radio>
          </v-radio-group>
        </div>
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
    <v-switch
      v-model="normalization_switch"
      label="normalize"
      class="ml-8"
    ></v-switch>
    <div  ref="svg" />
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import * as d3 from 'd3';

import {
  BoxProps,
  Instance,
  SelectionRecord,
} from '../../types';
import {
  instanceById,
  intersection,
} from '../../utils';
import { PredicateSimple, Rule } from '../constraints/types';
import { blankConstraint } from '../constraints/utils';
import { range } from 'd3';

export default Vue.extend({
  name: 'Trinary_Instance_Distribuion',
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
    const margin = {top: 150, right: 20, bottom: 90, left: 120};
    const width = 1000 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;
    const hover = {
      type: '' as 'right' | 'wrong' | '',
      classifier: '',
    };
    const hoverNormalization = {
      type: '' as 'right' | 'wrong' | '',
      selection: '',
      classifier: '',
    };
    const selection_mode = ' overall' as 'overall' | 'selected' 
    const distribution_mode = 'score' as 'score' | 'correcness' | 'correctness2'
    const weightedPerformance = 'normal' as 'normal' | 'weighted'

    return {
      svg: '',
      weightedPerformance,
      selection_mode:'overall',
      distribution_mode: 'score',
      thresholdRange: {},
      normalization:'No',
      height,
      hover,
      hoverNormalization,
      margin,
      panel: [],
      rightColor: '#d1e5f0',
      rightHoverColor: '#4393c3',
      selection1Color: '#18FFFF',
      selection2Color: '#FF4081',
      width,
      wrongColor: '#fddbc7',
      wrongHoverColor: '#d6604d',
      selection1Right: '#81AED7',
      selection1Wrong: '#D7AA81',
      selection1mid: '#C1BFC3',
      selection2Right: '#B981D7',
      selection2Wrong: '#D78E81',
      selection2mid: '#C1BFC3',
      classNumber:[...this.boxProps.classes].length,
    };
  },
  computed: {
    continuous_metrics() {
      return this.$store.state.continuous_metrics
    },
    weighted_metrics() {
      return this.$store.state.weighted_metrics;
    },
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
    classifierBandWidthDict(): string[] {
      return this.boxProps.classifierBandWidthDict;
    },
    bandWidthChangedClassifierName(): string {
      return this.$store.state.bandWidthChangedClassifierName
    },
    classes(): string[] {
      this.classNumber = [...this.boxProps.classes].length
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
    thresholdClassifierNameList():string[] {
      return this.$store.state.thresholdClassifierNameList
    },
    features(): string[] {
      return [...this.boxProps.features];
    },
    instances(): string[] {
      return [...this.boxProps.instances];
    },
    predictionKeys(): string[] {

      var scope = this.evaluationKeys
      
      const accuracyAscending = (c1: string, c2: string) => {
        return this.predictions[c1].right_size - this.predictions[c2].right_size;
      };
      const accuracyDescending = (c1: string, c2: string) => {
        return -accuracyAscending(c1, c2);
      };

      const predictionKeys = this.classifiers.slice();
     
      return predictionKeys;
    },
    continuousPredictionKeys():string[]{
      return this.addedBandWidthClassifiers.map((c)=>{
        return c.name
      })
    },
    evaluationKeys() : String {
      return "accuracy";
    },
    classifierThresholdDict():{} {
      return this.$store.state.classifierThresholdDict
    }, 
    continuousClassifierName():{} {
      var continuousClassifierName = {}
      this.classifiers.forEach((c)=>{
        if (this.$store.state.datasetType == "continuous") {
          continuousClassifierName[c] = c + "_" + this.classifierThresholdDict[c]/100
        } else {
          continuousClassifierName[c] = c;
        }
      })
      return continuousClassifierName;
    },
    predictions(): {
      [classifier: string]: {
        name: String,
        threshold: number,
        right: Set<string>,
        right_wrong: Set<string>,
        right_right: Set<string>,
        wrong: Set<string>,
        wrong_wrong: Set<string>,
        wrong_right: Set<string>,
        middle_wrong: Set<string>,
        middle_right: Set<string>,
        middle_tp: Set<string>,
        middle_tn: Set<string>,
        middle_fp: Set<string>,
        middle_fn: Set<string>,
        accuracy:number,
        total_size:number,
        right_size:number,
        wrong_size:number,
        middle_right_size:number,
        middle_wrong_size:number,
      },
    } {
      const predictions: {
        [classifier: string]: {
          name: String,
          threshold: number,
          right: Set<string>,
          right_wrong: Set<string>,
          right_right: Set<string>,
          wrong: Set<string>,
          wrong_wrong: Set<string>,
          wrong_right: Set<string>,
          middle_wrong: Set<string>,
          middle_right: Set<string>,
          middle_tp: Set<string>,
          middle_tn: Set<string>,
          middle_fp: Set<string>,
          middle_fn: Set<string>,
          accuracy:number,
          total_size:number,
          right_size:number,
          wrong_size:number,
          middle_right_size:number,
          middle_wrong_size:number,
        },
      } = {};

      this.addedBandWidthClassifiers.forEach((c)=>{
        let classifier = c.name.split('(')[0]
        predictions[c.name] = {
          name: c.name,
          threshold: Object.keys( this.classifierThresholdDict).includes(classifier)? this.classifierThresholdDict[classifier] : 0,
          right: new Set(),
          right_wrong: new Set(),
          right_right: new Set(),
          wrong: new Set(),
          wrong_wrong: new Set(), 
          wrong_right: new Set(),
          middle_wrong: new Set(),
          middle_right: new Set(),
          middle_tp: new Set(),
          middle_tn: new Set(),
          middle_fp: new Set(),
          middle_fn: new Set(),
          accuracy:0,
          total_size:0,
          right_size:0,
          wrong_size:0,
          middle_right_size:0,
          middle_wrong_size:0,
        };
      })

      const continuous_metrics = this.weightedPerformance == 'normal' ? this.$store.state.continuous_metrics : this.$store.state.weighted_metrics;
      
            
      const value_dict = {
        'middle_fn' : 'm_fn_instances',
        'middle_fp' : 'm_fp_instances',
        'middle_tp' : 'm_tp_instances',
        'middle_tn' : 'm_tn_instances',
        'right_right': 'tp_instances',
        'wrong_wrong': 'tn_instances',
        'wrong_right': 'fp_instances',
        'right_wrong': 'fn_instances',
        'm_fp':'m_fp',
        'm_tp':'m_tp',
        'm_fn':'m_fn',
        'm_tn':'m_tn',
        'tp':'tp',
        'tn':'tn',
        'fp':'fp',
        'fn':'fn',
      }
      this.addedBandWidthClassifiers.forEach((c)=>{
        let classifier = c.name.split('(')[0]
        let left_edge = parseFloat(c.name.substring(c.name.length-10, c.name.length-6)).toFixed(2)
        let right_edge = parseFloat(c.name.substring(c.name.length-5, c.name.length-1)).toFixed(2)
        let cur_threshold  = (parseFloat(right_edge) + parseFloat(left_edge)) / 2
        if (left_edge == continuous_metrics[classifier]['cur_left_edge'].toFixed(2) && right_edge == continuous_metrics[classifier]['cur_right_edge'].toFixed(2)) {
          predictions[c.name].threshold = cur_threshold;
          for (let key in value_dict) {
            predictions[c.name][key] = continuous_metrics[classifier][value_dict[key]]
          }
          predictions[c.name]['right_size'] = continuous_metrics[classifier]['tp'] + continuous_metrics[classifier]['fn']
          predictions[c.name]['wrong_size'] = continuous_metrics[classifier]['fp'] + continuous_metrics[classifier]['tn']
          predictions[c.name]['middle_right_size'] = continuous_metrics[classifier]['m_tp'] + continuous_metrics[classifier]['m_fp']
          predictions[c.name]['middle_wrong_size'] = continuous_metrics[classifier]['m_tn'] + continuous_metrics[classifier]['m_fn']
          
        } else {
          this.instances.forEach((id)=>{
            const i = instanceById(id);
            const actual = i.actual == this.classes[1] ? 1 : 0;
            const predict_prob = i.continuous_predictions[classifier];
            if (predict_prob < right_edge && predict_prob > left_edge) {
              if (actual == 0) {
                if (predict_prob < predictions[c.name].threshold) {
                  predictions[c.name].middle_tn.add(id)
                } else {
                  predictions[c.name].middle_fp.add(id)
                }
              } else {
                if (predict_prob >= predictions[c.name].threshold) {
                  predictions[c.name].middle_tp.add(id)
                } else {
                  predictions[c.name].middle_fn.add(id)
                }
              }
            } else{
              if (actual == 0) {
                if (predict_prob < left_edge) {
                  predictions[c.name].wrong_wrong.add(id)
                } else {
                  predictions[c.name].wrong_right.add(id)
                }
              } else {
                if (predict_prob >= right_edge) {
                  predictions[c.name].right_right.add(id)
                } else {
                  predictions[c.name].right_wrong.add(id)
                }
              }
            }
          })
          if (this.weightedPerformance == 'normal') {
            predictions[c.name]['m_fp'] = predictions[c.name]['middle_fp'].size
            predictions[c.name]['m_tp'] = predictions[c.name]['middle_tp'].size
            predictions[c.name]['m_fn'] = predictions[c.name]['middle_fn'].size
            predictions[c.name]['m_tn'] = predictions[c.name]['middle_tn'].size
            predictions[c.name]['fp'] = predictions[c.name]['wrong_right'].size
            predictions[c.name]['tp'] = predictions[c.name]['right_right'].size
            predictions[c.name]['fn'] = predictions[c.name]['right_wrong'].size
            predictions[c.name]['tn'] = predictions[c.name]['wrong_wrong'].size
          } else {
            let instanceWeights = {};
            let selectionHistory  = this.$store.state.selectionHistory;
            let changed_instances_set   = [
              ['right_right', 'tp'],
              ['wrong_wrong', 'tn'],
              ['right_wrong', 'fn'],
              ['wrong_right', 'fp'],
              ['middle_tp', 'm_tp'],
              ['middle_tn', 'm_tn'],
              ['middle_fp', 'm_fn'],
              ['middle_fn', 'm_fp'],
            ]  
            
            this.instances.forEach((c)=>{
              instanceWeights[c] = 1
            })

            selectionHistory.forEach((s)=>{
              let tmp_instances = [...s.instances]
              let weight = parseFloat((s.weight).toString())
              tmp_instances.forEach((i)=>{
                instanceWeights[i] += weight
              })
            })
            changed_instances_set.forEach((cur_set)=>{
              let cur_instances = [...predictions[c.name][cur_set[0]]]
              let cur_value = cur_set[1]
              let count = 0
              cur_instances.forEach((i)=>{
                count += instanceWeights[i]
              })
              predictions[c.name][cur_value] = count
            })
          }
          predictions[c.name]['right_size'] = predictions[c.name]['tp'] + predictions[c.name]['fn']
          predictions[c.name]['wrong_size'] = predictions[c.name]['fp'] + predictions[c.name]['tn']
          predictions[c.name]['middle_right_size'] = predictions[c.name]['m_tp'] + predictions[c.name]['m_fp']
          predictions[c.name]['middle_wrong_size'] = predictions[c.name]['m_tn'] + predictions[c.name]['m_fn']

        }
        predictions[c.name]['middle_right'] = new Set([...predictions[c.name]['middle_tp'], ...predictions[c.name]['middle_fp']]);
        predictions[c.name]['middle_wrong'] = new Set([...predictions[c.name]['middle_tn'], ...predictions[c.name]['middle_fn']]);
        predictions[c.name]['right'] = new Set([...predictions[c.name]['right_wrong'], ...predictions[c.name]['right_right']]);
        predictions[c.name]['wrong'] = new Set([...predictions[c.name]['wrong_wrong'], ...predictions[c.name]['wrong_right']]);
        predictions[c.name]['total_size'] =  predictions[c.name]['right_size'] +  predictions[c.name]['wrong_size']
                                    + predictions[c.name]['middle_right_size'] + predictions[c.name]['middle_wrong_size']
      })

      this.addedBandWidthClassifiers.forEach((c)=>{
        predictions[c.name].accuracy =  predictions[c.name].right_size / (predictions[c.name].right_size + predictions[c.name].wrong_size)
      })


      return predictions;
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
        .domain(this.continuousPredictionKeys)
        .range([0, this.width*0.8])
        .paddingOuter(1)
        .paddingInner(0.3);
      return x;
    },
    y(): d3.ScaleLinear<number, number> {
      const y = d3.scaleLinear()
        .domain([0, 1])
        .range([this.height, 0]);
      return y;
    },
    xScale(): d3.ScaleLinear<number, number> {
      const xScale = d3.scaleLinear()
          .domain([0, 160])
          .range([10, 160])
          .clamp(true);
      return xScale;      
    },
    yScale(): d3.ScaleBand<string> {
      const yScale = d3.scaleBand<string>()
            .range([(this.height+this.margin.bottom), 0])
            .padding(0.1).domain(this.predictionKeys);
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
        if (view.name == 'Trinary_Instance_Distribuion') {
          if (view.config) {
            let value  = view.config;
            this.selection_mode = value.selection
            this.distribution_mode = value.distribution
          }
        }
      })
      this.drawInitial();
    },
    saveStatus() {
      let config = {"name":"Trinary_Instance_Distribuion", 
                    "config": {
                      "selection":this.selection_mode,
                      "distribution":this.distribution_mode}}
      this.$store.dispatch("changedSaveConfig",config)
    },
    weightedPerformance() {
      this.drawInitial();
    },
    addedBandWidthClassifiers() {
      this.drawInitial();
    },
    selection_mode() {
      if (this.weightedPerformance == 'weighted' && this.selection_mode == 'selected') {
        this.weightedPerformance = 'normal'
      }
      this.drawInitial();
    },
    weighted_metrics() {
      if (this.weightedPerformance == 'weighted') {
        this.drawInitial();
      }
    },
    distribution_mode() {
      this.drawInitial();
    },
    hoverNormalization() {
      this.drawHoverNormalization();
    },
    normalization() {
      if (this.normalization == 'Yes') {
        this.drawNormalization();
      } else {
        this.drawInitial();
      }
    },
    accuracySorting() {
      this.drawInitial();
    },
    evaluationSelection() {
      this.drawInitial();
    },
    hover() {
      this.drawHover();
    },
    instances() {
      this.drawInitial();
    },
    selections() {
      if (this.normalization == 'Yes') {
        this.drawNormalization();
      } else {
        this.drawInitial();
      }
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
      if (view.name == 'Trinary_Instance_Distribuion') {
        if (view.config) {
          let value  = view.config;
          this.selection_mode = value.selection
          this.distribution_mode = value.distribution
        }
      }
    })
    this.drawInitial();
  },
  methods: {  
    clearHover() {
      this.hover = ({type: '', slection:'', classifier: ''});
    },
    clearHoverNormalization() {
      this.hoverNormalization = ({type: '', classifier: ''});
    },
    drawHover() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      const rightBars = chart.selectAll('.bar-right-right');
      const wrongBars = chart.selectAll('.bar-wrong-wrong');
      const rightwrongBars = chart.selectAll('.bar-right-wrong');
      const wrongrightBars = chart.selectAll('.bar-wrong-right');
      const middleYesBars = chart.selectAll('.bar-middle-yes');
      const yAxisMarkerRect = chart.select('.y-axis-marker-rect');
      const yAxisMarkerLine1 = chart.select('.y-axis-marker-line-1');
      const yAxisMarkerLine2 = chart.select('.y-axis-marker-line-2');
      const yAxisMarkerLine3 = chart.select('.y-axis-marker-line-3');
      const yAxisMarkerLine4 = chart.select('.y-axis-marker-line-4');
      const yAxisMarkerText1 = chart.select('.y-axis-marker-text-1');
      const yAxisMarkerText2 = chart.select('.y-axis-marker-text-2');
      const yAxisMarkerText3 = chart.select('.y-axis-marker-text-3');
      const yAxisMarkerText4 = chart.select('.y-axis-marker-text-4');
      const yAxisMarkerText5 = chart.select('.y-axis-marker-text-5');
      const yAxisMarkerText1s1 = chart.select('.y-axis-marker-text-1-s1');
      const yAxisMarkerText2s1 = chart.select('.y-axis-marker-text-2-s1');
      const yAxisMarkerText3s1 = chart.select('.y-axis-marker-text-3-s1');
      const yAxisMarkerText4s1 = chart.select('.y-axis-marker-text-4-s1');
      const yAxisMarkerText5s1 = chart.select('.y-axis-marker-text-5-s1');
      const yAxisMarkerText1s2 = chart.select('.y-axis-marker-text-1-s2');
      const yAxisMarkerText2s2 = chart.select('.y-axis-marker-text-2-s2');
      const yAxisMarkerText3s2 = chart.select('.y-axis-marker-text-3-s2');
      const yAxisMarkerText4s2 = chart.select('.y-axis-marker-text-4-s2');
      const yAxisMarkerText5s2 = chart.select('.y-axis-marker-text-5-s2');
      const { first, second } = this.selections;
      const predictions = this.predictions;

      const hoverText = (classifierName:string, typeString: string, selection: Set<string>) => {
        let instances = predictions[classifierName][typeString]
        if (typeString == 'middle') {
          instances = new Set([...predictions[classifierName]['middle_wrong'],...predictions[classifierName]['middle_right']] )
        }
        var totalInstances = 0 
        totalInstances = predictions[classifierName].total_size
        const overlappingInstances = intersection(instances, selection);
        const fractionOfTotalInstances = overlappingInstances.size / totalInstances * 100;
        return fractionOfTotalInstances.toFixed(1);
      };

      if (this.hover.type === 'right_right' && this.hover.selection == '') {
        rightBars.data(this.continuousPredictionKeys)
          .attr('fill', (d: string) =>
            d === this.hover.classifier
              ? this.rightHoverColor
              : this.rightColor);
      } else {
        if (this.selection_mode == 'overall')
          rightBars.attr('fill', this.rightColor);
      }

      if (this.hover.type === 'wrong_wrong' && this.hover.selection == '') {
        wrongBars.data(this.continuousPredictionKeys)
          .attr('fill', (d: string) =>
            d === this.hover.classifier
              ? this.rightHoverColor
              : this.rightColor);
      } else {
        if (this.selection_mode == 'overall')
          wrongBars.attr('fill', this.rightColor);
      }

      if (this.hover.type === 'wrong_right' && this.hover.selection == '') {
        wrongrightBars.data(this.continuousPredictionKeys)
          .attr('fill', (d: string) =>
            d === this.hover.classifier
              ? this.wrongHoverColor
              : this.wrongColor);
      } else {
        if (this.selection_mode == 'overall')
          wrongrightBars.attr('fill', this.wrongColor);
      }

      if (this.hover.type === 'right_wrong' && this.hover.selection == '') {
         rightwrongBars.data(this.continuousPredictionKeys)
          .attr('fill', (d: string) =>
            d === this.hover.classifier
              ? this.wrongHoverColor
              : this.wrongColor);
      } else {
        if (this.selection_mode == 'overall')
          rightwrongBars.attr('fill', this.wrongColor);
      }

      if (this.hover.type === 'middle-yes' && this.hover.selection == '') {
        middleYesBars.data(this.continuousPredictionKeys)
          .attr('fill', (d: string) =>
            d === this.hover.classifier
              ? "grey"
              : "lightgrey");
      } else {
        if (this.selection_mode == 'overall')
          middleYesBars.attr('fill',"lightgrey");
      }


      const moveDuration = 500;
      const disappearDuration = 1000;
      if (this.hover.type) {
          yAxisMarkerRect
            .transition()
            .duration(moveDuration)
            .attr('stroke-opacity', 1)
          yAxisMarkerLine1
            .transition()
            .duration(moveDuration)
            .attr('stroke-opacity', 1)
            .attr('y1',  
              this.y(predictions[this.hover.classifier].fp / predictions[this.hover.classifier].total_size))
            .attr('x2', this.width)
            .attr('y2', this.y(predictions[this.hover.classifier].fp / predictions[this.hover.classifier].total_size));
          yAxisMarkerLine2
            .transition()
            .duration(moveDuration)
            .attr('stroke-opacity', 1)
            .attr('y1', this.distribution_mode != 'correctness'? 
              this.y((predictions[this.hover.classifier].fp+predictions[this.hover.classifier].tn) / predictions[this.hover.classifier].total_size)
              :this.y((predictions[this.hover.classifier].fp+predictions[this.hover.classifier].fn) / predictions[this.hover.classifier].total_size))
            .attr('x2', this.width)
            .attr('y2', this.distribution_mode != 'correctness'? 
              this.y((predictions[this.hover.classifier].fp+predictions[this.hover.classifier].tn) / predictions[this.hover.classifier].total_size)
              :this.y((predictions[this.hover.classifier].fp+predictions[this.hover.classifier].fn) / predictions[this.hover.classifier].total_size))
          yAxisMarkerLine3
            .transition()
            .duration(moveDuration)
            .attr('stroke-opacity', 1)
            .attr('y1',  this.distribution_mode != 'correctness'? 
              this.y((predictions[this.hover.classifier].fp+predictions[this.hover.classifier].tn+predictions[this.hover.classifier].middle_wrong_size+predictions[this.hover.classifier].middle_right_size) / predictions[this.hover.classifier].total_size)
              :this.y((predictions[this.hover.classifier].fp+predictions[this.hover.classifier].fn+predictions[this.hover.classifier].middle_wrong_size+predictions[this.hover.classifier].middle_right_size) / predictions[this.hover.classifier].total_size))
            .attr('x2', this.width)
            .attr('y2',  this.distribution_mode != 'correctness'? 
              this.y((predictions[this.hover.classifier].fp+predictions[this.hover.classifier].tn+predictions[this.hover.classifier].middle_wrong_size+predictions[this.hover.classifier].middle_right_size) / predictions[this.hover.classifier].total_size)
              :this.y((predictions[this.hover.classifier].fp+predictions[this.hover.classifier].fn+predictions[this.hover.classifier].middle_wrong_size+predictions[this.hover.classifier].middle_right_size) / predictions[this.hover.classifier].total_size))
          yAxisMarkerLine4
            .transition()
            .duration(moveDuration)
            .attr('stroke-opacity', 1)
            .attr('y1', this.height - this.y((predictions[this.hover.classifier].tp) / predictions[this.hover.classifier].total_size))
            .attr('x2', this.width)
            .attr('y2', this.height - this.y((predictions[this.hover.classifier].tp) / predictions[this.hover.classifier].total_size));  

          yAxisMarkerText1
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)
            .text("tp: "+`${(predictions[this.hover.classifier].tp / predictions[this.hover.classifier].total_size * 100).toFixed(1)}%`);
          yAxisMarkerText2
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .text(this.distribution_mode != 'correctness'? 
                "fn: "+`${(predictions[this.hover.classifier].fn / predictions[this.hover.classifier].total_size * 100).toFixed(1)}%`
                :"tn: "+`${(predictions[this.hover.classifier].tn / predictions[this.hover.classifier].total_size * 100).toFixed(1)}%`);
          yAxisMarkerText3
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .text( "?: "+`${((predictions[this.hover.classifier].middle_right_size+predictions[this.hover.classifier].middle_wrong_size) / predictions[this.hover.classifier].total_size * 100).toFixed(1)}%`);
          yAxisMarkerText4
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)
            .text(this.distribution_mode != 'correctness'? 
              "tn: "+`${(predictions[this.hover.classifier].tn / predictions[this.hover.classifier].total_size * 100).toFixed(1)}%`
              :"fn: "+`${(predictions[this.hover.classifier].fn / predictions[this.hover.classifier].total_size * 100).toFixed(1)}%`);
          yAxisMarkerText5
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .text("fp: "+`${(predictions[this.hover.classifier].fp / predictions[this.hover.classifier].total_size * 100).toFixed(1)}%`);

          if (first) {
            yAxisMarkerText1s1
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)
            .text("1st: "+hoverText(this.hover.classifier, 'right_right', first.instances));
          yAxisMarkerText2s1
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .text(this.distribution_mode != 'correctness'? 
                "1st: "+hoverText(this.hover.classifier, 'right_wrong', first.instances)
                :"1st: "+hoverText(this.hover.classifier, 'wrong_wrong', first.instances));
          yAxisMarkerText3s1
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .text("1st: "+hoverText(this.hover.classifier, 'middle', first.instances));
          yAxisMarkerText4s1
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)
            .text(this.distribution_mode != 'correctness'? 
              "1st: "+hoverText(this.hover.classifier, 'wrong_wrong', first.instances)
              :"1st: "+hoverText(this.hover.classifier, 'right_wrong', first.instances));
          yAxisMarkerText5s1
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .text("1st: "+hoverText(this.hover.classifier, 'wrong_right', first.instances));
          } 
          if (second) {
            yAxisMarkerText1s2
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)
            .text("2nd: "+hoverText(this.hover.classifier, 'right_right', second.instances));
          yAxisMarkerText2s2
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .text(this.distribution_mode != 'correctness'? 
                "2nd: "+hoverText(this.hover.classifier, 'right_wrong', second.instances)
                :"2nd: "+hoverText(this.hover.classifier, 'wrong_wrong', second.instances));
          yAxisMarkerText3s2
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .text("2nd: "+hoverText(this.hover.classifier, 'middle', second.instances));
          yAxisMarkerText4s2
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)
            .text(this.distribution_mode != 'correctness'? 
              "2nd: "+hoverText(this.hover.classifier, 'wrong_wrong', second.instances)
              :"2nd: "+hoverText(this.hover.classifier, 'right_wrong', second.instances));
          yAxisMarkerText5s2
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .text("2nd: "+hoverText(this.hover.classifier, 'wrong_right', second.instances));

          }

      } else { 
        yAxisMarkerRect
            .transition()
            .duration(moveDuration)
            .attr('stroke-opacity', 0);
        yAxisMarkerLine1
          .transition()
          .duration(disappearDuration)
          .attr('stroke-opacity', 0);
        yAxisMarkerLine2
          .transition()
          .duration(disappearDuration)
          .attr('stroke-opacity', 0); 
        yAxisMarkerLine3
          .transition()
          .duration(disappearDuration)
          .attr('stroke-opacity', 0);
        yAxisMarkerLine4
          .transition()
          .duration(disappearDuration)
          .attr('stroke-opacity', 0); 
        yAxisMarkerText1
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerText2
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerText3
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);       
        yAxisMarkerText4
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerText5
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);    
        yAxisMarkerText1s1
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerText2s1
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerText3s1
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);       
        yAxisMarkerText4s1
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerText5s1
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);   
        yAxisMarkerText1s2
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerText2s2
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerText3s2
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);       
        yAxisMarkerText4s2
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerText5s2
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
      }
    },
    drawHoverNormalization() {
      const chart = d3.select(this.$refs.svg);
      const rightBars = chart.selectAll('.bar-right-right-norm');
      const wrongBars = chart.selectAll('.bar-wrong-wrong-norm');
      const rightwrongBars = chart.selectAll('.bar-right-wrong-norm');
      const wrongrightBars = chart.selectAll('.bar-wrong-right-norm');
      const middleYesBars = chart.selectAll('.bar-middle-yes-norm');
      const yAxisMarkerRect = chart.select('.y-axis-marker-rect-norm');
      const yAxisMarkerLine1 = chart.select('.y-axis-marker-line-1-norm');
      const yAxisMarkerLine2 = chart.select('.y-axis-marker-line-2-norm');
      const yAxisMarkerLine3 = chart.select('.y-axis-marker-line-3-norm');
      const yAxisMarkerLine4 = chart.select('.y-axis-marker-line-4-norm');
      const yAxisMarkerText1 = chart.select('.y-axis-marker-text-1-norm');
      const yAxisMarkerText2 = chart.select('.y-axis-marker-text-2-norm');
      const yAxisMarkerText3 = chart.select('.y-axis-marker-text-3-norm');
      const yAxisMarkerText4 = chart.select('.y-axis-marker-text-4-norm');
      const yAxisMarkerText5 = chart.select('.y-axis-marker-text-5-norm');
      const yAxisMarkerText1s1 = chart.select('.y-axis-marker-text-1-s1-norm');
      const yAxisMarkerText2s1 = chart.select('.y-axis-marker-text-2-s1-norm');
      const yAxisMarkerText3s1 = chart.select('.y-axis-marker-text-3-s1-norm');
      const yAxisMarkerText4s1 = chart.select('.y-axis-marker-text-4-s1-norm');
      const yAxisMarkerText5s1 = chart.select('.y-axis-marker-text-5-s1-norm');
      const yAxisMarkerText1s2 = chart.select('.y-axis-marker-text-1-s2-norm');
      const yAxisMarkerText2s2 = chart.select('.y-axis-marker-text-2-s2-norm');
      const yAxisMarkerText3s2 = chart.select('.y-axis-marker-text-3-s2-norm');
      const yAxisMarkerText4s2 = chart.select('.y-axis-marker-text-4-s2-norm');
      const yAxisMarkerText5s2 = chart.select('.y-axis-marker-text-5-s2-norm');
      const { first, second } = this.selections;
      const predictions = this.predictions 

      const hoverText = (classifierName:string, typeString: string, selection: Set<string>) => {
        let instances = predictions[classifierName][typeString]
        if (typeString == 'middle') {
          instances = new Set([...predictions[classifierName]['middle_wrong'],...predictions[classifierName]['middle_right']] )
        }
        var totalInstances = 0 
        totalInstances = predictions[classifierName].total_size
        const overlappingInstances = intersection(instances, selection);
        const fractionOfTotalInstances = instances.size == 0? 0: overlappingInstances.size / instances.size * 100;
        return fractionOfTotalInstances.toFixed(1);
      };

      if (this.hoverNormalization.type === 'right_right') {
        rightBars.data(this.continuousPredictionKeys)
          .attr('fill', (d: string) =>
            d === this.hoverNormalization.classifier
              ? this.rightHoverColor
              : this.rightColor);
      } else {
        rightBars.attr('fill', this.rightColor);
      }

      if (this.hoverNormalization.type === 'wrong_wrong') {
        wrongBars.data(this.continuousPredictionKeys)
          .attr('fill', (d: string) =>
            d === this.hoverNormalization.classifier
              ? this.rightHoverColor
              : this.rightColor);
      } else {
        wrongBars.attr('fill', this.rightColor);
      }

      if (this.hoverNormalization.type === 'wrong_right') {
        wrongrightBars.data(this.continuousPredictionKeys)
          .attr('fill', (d: string) =>
            d === this.hoverNormalization.classifier
              ? this.wrongHoverColor
              : this.wrongColor);
      } else {
        wrongrightBars.attr('fill', this.wrongColor);
      }

      if (this.hoverNormalization.type === 'right_wrong') {
         rightwrongBars.data(this.continuousPredictionKeys)
          .attr('fill', (d: string) =>
            d === this.hoverNormalization.classifier
              ? this.wrongHoverColor
              : this.wrongColor);
      } else {
         rightwrongBars.attr('fill', this.wrongColor);
      }

      if (this.hoverNormalization.type === 'middle-yes') {
        middleYesBars.data(this.continuousPredictionKeys)
          .attr('fill', (d: string) =>
            d === this.hoverNormalization.classifier
              ? "grey"
              : "lightgrey");
      } else {
        middleYesBars.attr('fill',"lightgrey");
      }


      const moveDuration = 500;
      const disappearDuration = 1000;
      if (this.hoverNormalization.type) {
          yAxisMarkerRect
            .transition()
            .duration(moveDuration)
            .attr('stroke-opacity', 1)
          yAxisMarkerLine1
            .transition()
            .duration(moveDuration)
            .attr('stroke-opacity', 1)
            .attr('y1',  this.y(0.2))
            .attr('x2', this.width)
            .attr('y2', this.y(0.2));
          yAxisMarkerLine2
            .transition()
            .duration(moveDuration)
            .attr('stroke-opacity', 1)
            .attr('y1', this.y(0.4))
            .attr('x2', this.width)
            .attr('y2', this.y(0.4));
          
          yAxisMarkerLine3
            .transition()
            .duration(moveDuration)
            .attr('stroke-opacity', 1)
            .attr('y1',  this.y(0.6))
            .attr('x2', this.width)
            .attr('y2',  this.y(0.6));
          yAxisMarkerLine4
            .transition()
            .duration(moveDuration)
            .attr('stroke-opacity', 1)
            .attr('y1',  this.y(0.8))
            .attr('x2', this.width)
            .attr('y2',  this.y(0.8));

          yAxisMarkerText1
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)
            .text('tp-norm')
          yAxisMarkerText2
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .text(this.distribution_mode != 'correctness' ? 'fn-norm' : 'tn-norm')
             
          yAxisMarkerText3
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .text('uncertain-norm')
          yAxisMarkerText4
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)
            .text(this.distribution_mode != 'correctness' ? 'tn-norm' : 'fn-norm')
          yAxisMarkerText5
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .text('fp-norm')

          if (first) {
            yAxisMarkerText1s1
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)
            .text("1st: "+hoverText(this.hoverNormalization.classifier, 'right_right', first.instances));
          yAxisMarkerText2s1
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .text("1st: "+hoverText(this.hoverNormalization.classifier, 'right_wrong', first.instances));
          yAxisMarkerText3s1
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .text("1st: "+hoverText(this.hoverNormalization.classifier, 'middle', first.instances));
          yAxisMarkerText4s1
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)
            .text("1st: "+hoverText(this.hoverNormalization.classifier, 'wrong_wrong', first.instances));
          yAxisMarkerText5s1
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .text("1st: "+hoverText(this.hoverNormalization.classifier, 'wrong_right', first.instances));
          } 
          if (second) {
            yAxisMarkerText1s2
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)
            .text("2nd: "+hoverText(this.hoverNormalization.classifier, 'right_right', second.instances));
          yAxisMarkerText2s2
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .text("2nd: "+hoverText(this.hoverNormalization.classifier, 'right_wrong', second.instances));
          yAxisMarkerText3s2
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .text("2nd: "+hoverText(this.hoverNormalization.classifier, 'middle', second.instances));
          yAxisMarkerText4s2
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)
            .text("2nd: "+hoverText(this.hoverNormalization.classifier, 'wrong_wrong', second.instances));
          yAxisMarkerText5s2
              .transition()
              .duration(moveDuration)
              .attr('fill-opacity', 1)
              .text("2nd: "+hoverText(this.hoverNormalization.classifier, 'wrong_right', second.instances));

          }

      } else { 
        yAxisMarkerRect
            .transition()
            .duration(moveDuration)
            .attr('stroke-opacity', 0);
        yAxisMarkerLine1
          .transition()
          .duration(disappearDuration)
          .attr('stroke-opacity', 0);
        yAxisMarkerLine2
          .transition()
          .duration(disappearDuration)
          .attr('stroke-opacity', 0); 
        yAxisMarkerLine3
          .transition()
          .duration(disappearDuration)
          .attr('stroke-opacity', 0);
        yAxisMarkerLine4
          .transition()
          .duration(disappearDuration)
          .attr('stroke-opacity', 0); 
        yAxisMarkerText1
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerText2
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerText3
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);       
        yAxisMarkerText4
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerText5
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);    
        yAxisMarkerText1s1
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerText2s1
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerText3s1
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);       
        yAxisMarkerText4s1
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerText5s1
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);   
        yAxisMarkerText1s2
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerText2s2
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerText3s2
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);       
        yAxisMarkerText4s2
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerText5s2
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
      }
    },
    drawNormalization() {
      d3.select(this.$refs.svg).selectAll('*').remove();
      const x = this.x;
      const y = this.y;
      const svgAll = d3.select(this.$refs.svg).append('svg')
        .attr('width', '100%')
        .attr('viewBox', `0 0
          ${(this.width + this.margin.left + this.margin.right)}
          ${(this.height + this.margin.top + this.margin.bottom)*1.2}`)
      const svg = svgAll.append('g')
          .attr('transform', `translate(${this.margin.left*1.2}, ${this.margin.top*1.5})`);


      const drawAxes = () => {
        const xAxis = (g: any) => g
          .attr('transform', `translate(${0}, ${this.height})`)
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

        const yAxis = (g: any) => g
          .call(d3.axisLeft(y)
            .ticks(5)
            .tickFormat(d3.format('.0%')),
          );

        svg.append('g')
          .call(yAxis)
          .attr('font-size', 20);
      };
      drawAxes();

      const drawTitles = () => {
        
        svg.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('x', -this.height / 2)
          .attr('y', -this.margin.left * 0.9)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text('Fraction of instances');
        svg.append('text')
          .attr('x', this.width * 0.4)
          .attr('y', -100)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '32px')
          .text( 'Instance Distribution');  
      };
      drawTitles();

      const drawLegend = () => {
        const width = this.width / 6;
        const height = this.margin.top / 2;

        // @ts-ignore
        const legend = d3.select(this.$refs.svg)
          .select('svg')
          .append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(
              ${this.margin.left + this.width * 0.8},
              ${height / 3})`);

        legend.append('rect')
          .attr('width', width)
          .attr('height', height / 2)
          .attr('fill', this.rightColor)
          .style("visibility", "visible");

          
        legend.append('rect')
          .attr('y', height / 2)
          .attr('width', width)
          .attr('height', height / 2)
          .attr('fill',this.wrongColor )
          .style("visibility", "visible");

        legend.append('rect')
          .attr('y', height)
          .attr('width', width)
          .attr('height', height / 2)
          .attr('fill',"lightgrey" )
          .style("visibility", "visible");  

        legend.append('rect')
        .attr('y', height*1.5)
          .attr('width', width)
          .attr('height', height / 2)
          .attr('fill', this.rightColor)
          .style("visibility", "visible");

          
        legend.append('rect')
          .attr('y', height *2)
          .attr('width', width)
          .attr('height', height / 2)
          .attr('fill', this.wrongColor)
          .style("visibility", "visible");


        legend.append('text')
          .attr('transform', `translate(${width / 2}, ${height / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text( "tp")
          .style("visibility",  "visible");

        legend.append('text')
          .attr('transform', `translate(${width / 2}, ${height * 3 / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text( "fn")
          .style("visibility", "visible");
          
        legend.append('text')
          .attr('transform', `translate(${width / 2}, ${height * 5 / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text( "uncertain")
          .style("visibility", "visible");  
         legend.append('text')
          .attr('transform', `translate(${width / 2}, ${height * 7 / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text( "tn")
          .style("visibility", "visible");
          
        legend.append('text')
          .attr('transform', `translate(${width / 2}, ${height * 9 / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text( "fp")
          .style("visibility", "visible");  
      };
      drawLegend();

      const drawBars = () => {
        const barCells = svg.selectAll('.cell')
          .data(this.continuousPredictionKeys)
          .join('g')
            .attr('class', 'cell')
            .attr('transform', function (d: string){ 
              return `translate(${x(d)}, ${0})`});

        this.svg = svg;

        const barWidth = x.bandwidth();

        barCells.append('rect')
            .attr('class', 'bar-right-right-norm')
            .attr('y', (d: string) => y(1))
            .attr('width', function(d){
              return barWidth
              })
            .attr('height', (d: string) => this.height / 5 )
            .attr('fill', this.rightColor)
            .attr('stroke', 'black')
            .style('paint-order', 'stroke')
            .on('mouseenter', (d: string) => this.hoverNormalization = ({type: 'right_right', classifier: d}))
            .on('mouseleave', this.clearHoverNormalization)
            .on('click', (d: string) => this.select(d, 'right_right', 'first'))
            .on('contextmenu', (d: string) => this.select(d, 'right_right', 'second'));


        barCells.append('rect')
            .attr('class', 'bar-right-wrong-norm')
            .attr('y', (d: string) => this.height / 5 )
            .attr('width', function(d){
              return barWidth
              })
            .attr('height', (d: string) => this.height / 5)
            .attr('fill', this.wrongColor)
            .attr('stroke', 'black')
            .style('paint-order', 'stroke')
            .on('mouseenter', (d: string) => this.hoverNormalization = ({type: 'right_wrong', classifier: d}))
            .on('mouseleave', this.clearHoverNormalization)
            .on('click', (d: string) => this.select(d, 'right_wrong', 'first'))
            .on('contextmenu', (d: string) => this.select(d, 'right_wrong', 'second'))
            ;


        barCells.append('rect')
            .attr('class', 'bar-middle-yes-norm')
            .attr('y', (d: string) => this.height / 5 * 2 )
            .attr('width', function(d){
              return barWidth
              })
            .attr('height', (d: string) => this.height / 5)
            .attr('fill', "lightgrey")
            .attr('stroke', 'black')
            .style('paint-order', 'stroke')
            .on('mouseenter', (d: string) => this.hoverNormalization = ({type: 'middle-yes', classifier: d}))
            .on('mouseleave', this.clearHoverNormalization)
            .on('click', (d: string) => this.select(d, 'middle-yes', 'first'))
            .on('contextmenu', (d: string) => this.select(d, 'middle-yes', 'second')); 

 
        barCells.append('rect')
          .attr('class', 'bar-wrong-wrong-norm')
          .attr('y', (d: string) =>this.height / 5 * 3)
          .attr('width', barWidth)
          .attr('height', (d: string) => this.height / 5)
          .attr('fill', this.rightColor)
          .attr('stroke', 'black')
          .style('paint-order', 'stroke')
          .on('mouseenter', (d: string) => this.hoverNormalization = ({type: 'wrong_wrong', classifier: d}))
          .on('mouseleave', this.clearHoverNormalization) 
          .on('click', (d: string) => this.select(d, 'wrong_wrong', 'first'))
          .on('contextmenu', (d: string) => this.select(d, 'wrong_wrong', 'second'));



        barCells.append('rect')
          .attr('class', 'bar-wrong-right-norm')
          .attr('y', (d: string) =>this.height / 5 * 4)
          .attr('width', barWidth)
          .attr('height', (d: string) => this.height / 5)
          .attr('fill', this.wrongColor)
          .attr('stroke', 'black')
          .style('paint-order', 'stroke')
          .on('mouseenter', (d: string) => this.hoverNormalization = ({type: 'wrong_right', classifier: d}))
          .on('mouseleave', this.clearHoverNormalization) 
          .on('click', (d: string) => this.select(d, 'wrong_right', 'first'))
          .on('contextmenu', (d: string) => this.select(d, 'wrong_right', 'second'));


        
      };

      
      const yAxisMarkerLine = () => {
        svg.append('line')
          .attr('class', 'y-axis-marker-line-1-norm')
          .attr('x2', this.width)
          .attr('stroke', 'black')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr('pointer-events', 'none');
        svg.append('line')
          .attr('class', 'y-axis-marker-line-2-norm')
          .attr('x2', this.width)
          .attr('stroke', 'black')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr('pointer-events', 'none');  

        svg.append('line')
          .attr('class', 'y-axis-marker-line-3-norm')
          .attr('x2', this.width)
          .attr('stroke', 'black')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr('pointer-events', 'none'); 
        svg.append('line')
          .attr('class', 'y-axis-marker-line-4-norm')
          .attr('x2', this.width)
          .attr('stroke', 'black')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr('pointer-events', 'none'); 

      };

      const yAxisMarkerText = () => {
        svg.append('rect')
          .attr('class', 'y-axis-marker-rect-norm')
          .attr('width', '260')
          .attr('height', '150')
          .attr("x",this.width-this.margin.right-250)
          .attr('fill', "white")
          .attr('stroke',"lightgrey")
          .attr('stroke-width',"2px")
          .attr('pointer-events', 'none')
          .transition()
          .duration(1000)
          .attr('fill-opacity', 0);  

        svg.append('text')
          .attr('class', 'y-axis-marker-text-1-norm')
          .attr('transform', 'translate(' +(this.width-this.margin.right- 250)+ ', 0)') 
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', this.rightHoverColor)
          .attr('pointer-events', 'none');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-2-norm')
          .attr('transform', 'translate(' +(this.width-this.margin.right- 250)+ ', 40)') 
          .attr('font-size', 20)
          .attr('fill', this.distribution_mode != 'correctness'? 
            this.wrongHoverColor
            :this.rightHoverColor)
          .attr('pointer-events', 'none');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-3-norm')
          .attr('transform', 'translate(' +(this.width-this.margin.right- 250)+ ', 70)') 
          .attr('font-size', 20)
          .attr('fill', "grey")
          .attr('pointer-events', 'none');  
        svg.append('text')
          .attr('class', 'y-axis-marker-text-4-norm')
          .attr('transform', 'translate(' +(this.width-this.margin.right- 250)+ ', 100)') 
          .attr('font-size', 20)
          .attr('fill', this.distribution_mode != 'correctness'? 
            this.rightHoverColor
            :this.wrongHoverColor)
          .attr('pointer-events', 'none');  
        svg.append('text')
          .attr('class', 'y-axis-marker-text-5-norm')
          .attr('transform', 'translate(' +(this.width-this.margin.right- 250)+ ', 130)') 
          .attr('font-size', 20)
          .attr('fill', this.wrongHoverColor)
          .attr('pointer-events', 'none');  

        svg.append('text')
          .attr('class', 'y-axis-marker-text-1-s1-norm')
          .attr('transform', 'translate(' +(this.width-this.margin.right-160)+ ', 0)') 
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', "steelblue")
          .attr('pointer-events', 'none');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-2-s1-norm')
          .attr('transform', 'translate(' +(this.width-this.margin.right- 160)+ ', 40)') 
          .attr('font-size', 20)
          .attr('fill', "steelblue")
          .attr('pointer-events', 'none');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-3-s1-norm')
          .attr('transform', 'translate(' +(this.width-this.margin.right- 160)+ ', 70)') 
          .attr('font-size', 20)
          .attr('fill', "grey")
          .attr('pointer-events', 'none');  
        svg.append('text')
          .attr('class', 'y-axis-marker-text-4-s1-norm')
          .attr('transform', 'translate(' +(this.width-this.margin.right- 160)+ ', 100)') 
          .attr('font-size', 20)
          .attr('fill', "steelblue")
          .attr('pointer-events', 'none');  
        svg.append('text')
          .attr('class', 'y-axis-marker-text-5-s1-norm')
          .attr('transform', 'translate(' +(this.width-this.margin.right-160)+ ', 130)') 
          .attr('font-size', 20)
          .attr('fill', "steelblue")
          .attr('pointer-events', 'none');  

        svg.append('text')
          .attr('class', 'y-axis-marker-text-1-s2-norm')
          .attr('transform', 'translate(' +(this.width-this.margin.right-70)+ ', 0)') 
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', "red")
          .attr('pointer-events', 'none');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-2-s2-norm')
          .attr('transform', 'translate(' +(this.width-this.margin.right-70)+ ', 40)') 
          .attr('font-size', 20)
          .attr('fill', "red")
          .attr('pointer-events', 'none');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-3-s2-norm')
          .attr('transform', 'translate(' +(this.width-this.margin.right-70)+ ', 70)') 
          .attr('font-size', 20)
          .attr('fill', "grey")
          .attr('pointer-events', 'none');  
        svg.append('text')
          .attr('class', 'y-axis-marker-text-4-s2-norm')
          .attr('transform', 'translate(' +(this.width-this.margin.right-70)+ ', 100)') 
          .attr('font-size', 20)
          .attr('fill', "red")
          .attr('pointer-events', 'none');  
        svg.append('text')
          .attr('class', 'y-axis-marker-text-5-s2-norm')
          .attr('transform', 'translate(' +(this.width-this.margin.right-70)+ ', 130)') 
          .attr('font-size', 20)
          .attr('fill', "red")
          .attr('pointer-events', 'none');  
      };

      drawBars();
      yAxisMarkerLine();
      yAxisMarkerText();

      this.drawDistSelections();
      this.drawHoverNormalization();

    },
    drawInitial() {
      // @ts-ignore
      d3.select(this.$refs.svg).selectAll('*').remove();
      // @ts-ignore
      const svgAll = d3.select(this.$refs.svg).append('svg')
        .attr('width', '100%')
        .attr('viewBox', `0 0
          ${(this.width + this.margin.left + this.margin.right)}
          ${(this.height + this.margin.top + this.margin.bottom)*1.2}`)
      const svg = svgAll.append('g')
          .attr('transform', `translate(${this.margin.left*1.2}, ${this.margin.top*1.5})`);

      const x = this.x;
      const y = this.y;
      const continuousClassifierName = this.continuousClassifierName;

      
      // judge thresholdRange
      if (Object.keys(this.thresholdRange).length == 0) {
        const thresholdRange: {
          [classifier: string]: {
            name: String,
            threshold: Number,
            left_range: Number,
            right_range: Number,
          }
        } = {}
        this.classifiers.forEach((c) => {
          let cur_acc = 0
          thresholdRange[continuousClassifierName[c]] = {
            name:c,
            threshold: Object.keys( this.classifierThresholdDict).includes(c)? this.classifierThresholdDict[c] : 0,
            left_range:  !(Object.keys( this.classifierThresholdDict).includes(c))? 0:  (Object.keys(this.classifierBandWidthDict).length == 0) ? this.classifierThresholdDict[c] / 100 - 0.05 : this.classifierBandWidthDict[c].left_range,
            right_range: !(Object.keys( this.classifierThresholdDict).includes(c))? 0:  (Object.keys(this.classifierBandWidthDict).length == 0) ? this.classifierThresholdDict[c] / 100 + 0.05 : this.classifierBandWidthDict[c].right_range
          }
        })
        this.thresholdRange = thresholdRange
      }

      for (let c in this.thresholdRange){
        let splitL = c.split("_")
        let classifier =c.substring(0,c.length-splitL[splitL.length-1].length-1)
        let threshold = parseFloat(splitL[splitL.length-1])
        let left_range = this.thresholdRange[c].left_range
        let right_range = this.thresholdRange[c].right_range
        if (threshold == this.classifierThresholdDict[classifier]/100){
          continue
        }
        let left_diff = threshold - left_range
        let right_diff = right_range - threshold
        delete this.thresholdRange[c]
        this.thresholdRange[continuousClassifierName[classifier]] = {
          name:classifier,
          threshold: this.classifierThresholdDict[classifier],
          left_range:  this.classifierThresholdDict[classifier]/100 - left_diff,
          right_range: this.classifierThresholdDict[classifier] / 100 + right_diff,
        }
      }
      const predictions = this.predictions 

      const drawAxes = () => {
        const xAxis = (g: any) => g
          .attr('transform', `translate(${0}, ${this.height})`)
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

        const yAxis = (g: any) => g
          .call(d3.axisLeft(y)
            .ticks(5)
            .tickFormat(d3.format('.0%')),
          );

        svg.append('g')
          .call(yAxis)
          .attr('font-size', 20);
      };
      drawAxes();

      const drawTitles = () => {
       
        svg.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('x', -this.height / 2)
          .attr('y', -this.margin.left * 0.9)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text('Fraction of instances');
        svg.append('text')
          .attr('x', this.width * 0.4)
          .attr('y', -100)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '32px')
          .text( 'Instance Distribution');  
      };
      drawTitles();

      const drawLegend = () => {
        const width = this.width / 6;
        const height = this.margin.top / 2;
      
        // @ts-ignore
        const legend = d3.select(this.$refs.svg)
          .select('svg')
          .append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(
              ${this.margin.left + this.width * 0.8},
              ${height / 3})`);

        legend.append('rect')
          .attr('width', width)
          .attr('height', height / 2)
          .attr('fill', this.rightColor)
          .style("visibility", "visible");

          
        legend.append('rect')
          .attr('y', height / 2)
          .attr('width', width)
          .attr('height', height / 2)
          .attr('fill', this.distribution_mode == 'score'? this.wrongColor : this.rightColor )
          .style("visibility", "visible");

        if (this.distribution_mode != 'correctness2') {
          legend.append('rect')
          .attr('y', height)
          .attr('width', width)
          .attr('height', height / 2)
          .attr('fill',"lightgrey" )
          .style("visibility", "visible");  
        }
        

        legend.append('rect')
        .attr('y', this.distribution_mode != 'correctness2'? height*1.5 : height)
          .attr('width', width)
          .attr('height', height / 2)
          .attr('fill', this.distribution_mode != 'score'? this.wrongColor : this.rightColor )
          .style("visibility", "visible");

          
        legend.append('rect')
          .attr('y', this.distribution_mode != 'correctness2'? height*2 : height*1.5)
          .attr('width', width)
          .attr('height', height / 2)
          .attr('fill', this.wrongColor)
          .style("visibility", "visible");


        legend.append('text')
          .attr('transform', `translate(${width / 2}, ${height / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text( "tp")
          .style("visibility",  "visible");

        if (this.distribution_mode != 'correctness2') {
            legend.append('text')
            .attr('transform',  `translate(${width / 2}, ${height * 5 / 4})`)
            .attr('font-size', '20px')
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'middle')
            .text( "uncertain")
            .style("visibility", "visible");  
        }
        legend.append('text')
          .attr('transform', `translate(${width / 2}, ${height * 3 / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text(this.distribution_mode != 'score'? "tn":"fn")
          .style("visibility", "visible");
        
       
         legend.append('text')
          .attr('transform', this.distribution_mode != 'correctness2'? `translate(${width / 2}, ${height * 7 / 4})`
                                                                      : `translate(${width / 2}, ${height * 5 / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text( this.distribution_mode != 'score'?"fn":"tn")
          .style("visibility", "visible");
          
        legend.append('text')
          .attr('transform', this.distribution_mode != 'correctness2'? `translate(${width / 2}, ${height * 9 / 4})`
                                                                      : `translate(${width / 2}, ${height * 7 / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text( "fp")
          .style("visibility", "visible");  

        

      };

      const drawSelectedLegend = () => {
        const width = this.width / 6;
        const height = this.margin.top / 2;
        const selectionSets = [1,2]
        const legend = d3.select(this.$refs.svg)
            .select('svg')
            .append('g')
              .attr('class', 'legend')
              .attr('transform', `translate(
                ${this.margin.left + this.width * 0.8 },
                ${height / 3})`);
        // @ts-ignore
        selectionSets.forEach((selection_type)=>{
          const legend = d3.select(this.$refs.svg)
            .select('svg')
            .append('g')
              .attr('class', 'legend')
              .attr('transform', `translate(
                ${this.margin.left + this.width * 0.8 + (selection_type) * width * 0.28},
                ${height / 3})`);

          legend.append('text')
            .attr('transform', `translate(${width / 8}, ${-10})`)
            .attr('font-size', '20px')
            .attr('text-anchor', 'middle')
            .attr('alignment-baseline', 'middle')
            .text( "s"+selection_type)
            .style("visibility",  "visible");

          legend.append('rect')
            .attr('width', width / 4)
            .attr('height', height / 2)
            .attr('fill', selection_type == 1? this.selection1Right : this.selection2Right)
            .style("visibility", "visible");

            
          legend.append('rect')
            .attr('y', height / 2)
            .attr('width', width / 4)
            .attr('height', height / 2)
            .attr('fill',selection_type == 1? this.selection1Wrong : this.selection2Wrong )
            .style("visibility", "visible");

          legend.append('rect')
            .attr('y', height)
            .attr('width', width / 4)
            .attr('height', height / 2)
            .attr('fill',selection_type == 1? this.selection1mid : this.selection2mid)
            .style("visibility", "visible");  

          legend.append('rect')
          .attr('y', height*1.5)
            .attr('width', width / 4)
            .attr('height', height / 2)
            .attr('fill', selection_type == 1? this.selection1Right : this.selection2Right)
            .style("visibility", "visible");

            
          legend.append('rect')
            .attr('y', height *2)
            .attr('width', width / 4)
            .attr('height', height / 2)
            .attr('fill', selection_type == 1? this.selection1Wrong : this.selection2Wrong)
            .style("visibility", "visible");
        })
        legend.append('text')
          .attr('transform', `translate(${0}, ${height / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text( "tp")
          .style("visibility",  "visible");

        legend.append('text')
          .attr('transform', `translate(${0}, ${height * 3 / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text( "fp")
          .style("visibility", "visible");
          
        legend.append('text')
          .attr('transform', `translate(${0}, ${height * 5 / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text( "uncertain")
          .style("visibility", "visible");  
        legend.append('text')
          .attr('transform', `translate(${0}, ${height * 7 / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text( "tn")
          .style("visibility", "visible");
          
        legend.append('text')
          .attr('transform', `translate(${0}, ${height * 9 / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text( "fn")
          .style("visibility", "visible");  
        
      };
      if (this.selection_mode == 'overall') {
        drawLegend();
      } else {
        drawSelectedLegend();
      } 
      

      const drawBars = () => {
        const barCells = svg.selectAll('.cell')
          .data(this.continuousPredictionKeys)
          .join('g')
            .attr('class', 'cell')
            .attr('transform', function (d: string){ 
              return `translate(${x(d)}, ${0})`});

        this.svg = svg;

        const barWidth = x.bandwidth();

        barCells.append('rect')
            .attr('class', 'bar-right-right')
            .attr('y', (d: string) => y(1))
            .attr('width', function(d){
              return barWidth
              })
            .attr('height', (d: string) => this.height - y(predictions[d].tp / predictions[d].total_size))
            .attr('fill', this.rightColor)
            .attr('stroke', 'black')
            .style('paint-order', 'stroke')
            .on('mouseenter', (d: string) => this.hover = ({type: 'right_right', classifier: d}))
            .on('mouseleave', this.clearHover)
            .on('click', (d: string) => this.select(d, 'right_right', 'first'))
            .on('contextmenu', (d: string) => this.select(d, 'right_right', 'second'));
        
        barCells.append('rect')
            .attr('class', 'bar-right-wrong')
            .attr('y', (d: string) => this.height - y((predictions[d].tp) / predictions[d].total_size))
            .attr('width', function(d){
              return barWidth
              })
            .attr('height', (d: string) => this.height - y(predictions[d].fn / predictions[d].total_size))
            .attr('fill', this.wrongColor)
            .attr('stroke', 'black')
            .style('paint-order', 'stroke')
            .on('mouseenter', (d: string) => this.hover = ({type: 'right_wrong', classifier: d}))
            .on('mouseleave', this.clearHover)
            .on('click', (d: string) => this.select(d, 'right_wrong', 'first'))
            .on('contextmenu', (d: string) => this.select(d, 'right_wrong', 'second'));
        

        barCells.append('rect')
          .attr('class', 'bar-wrong-wrong')
          .attr('y', (d: string) =>this.height - y((predictions[d].right_size + predictions[d].middle_right_size+predictions[d].middle_wrong_size) / predictions[d].total_size))
          .attr('width', barWidth)
          .attr('height', (d: string) => this.height - y(predictions[d].tn / predictions[d].total_size))
          .attr('fill', this.rightColor)
          .attr('stroke', 'black')
          .style('paint-order', 'stroke')
          .on('mouseenter', (d: string) => this.hover = ({type: 'wrong_wrong', classifier: d}))
          .on('mouseleave', this.clearHover) 
          .on('click', (d: string) => this.select(d, 'wrong_wrong', 'first'))
          .on('contextmenu', (d: string) => this.select(d, 'wrong_wrong', 'second'));

        barCells.append('rect')
          .attr('class', 'bar-wrong-right')
          .attr('y', (d: string) =>y(predictions[d].fp / predictions[d].total_size))
          .attr('width', barWidth)
          .attr('height', (d: string) => this.height - y(predictions[d].fp / predictions[d].total_size))
          .attr('fill', this.wrongColor)
          .attr('stroke', 'black')
          .style('paint-order', 'stroke')
          .on('mouseenter', (d: string) => this.hover = ({type: 'wrong_right', classifier: d}))
          .on('mouseleave', this.clearHover) 
          .on('click', (d: string) => this.select(d, 'wrong_right', 'first'))
          .on('contextmenu', (d: string) => this.select(d, 'wrong_right', 'second'));
        

        barCells.append('rect')
            .attr('class', 'bar-middle-yes')
            .attr('y', (d: string) => this.height - y((predictions[d].right_size) / predictions[d].total_size))
            .attr('width', function(d){
              return barWidth
              })
            .attr('height', (d: string) => this.height - y((predictions[d].middle_right_size+predictions[d].middle_wrong_size) / predictions[d].total_size))
            .attr('fill', "lightgrey")
            .attr('stroke', 'black')
            .style('paint-order', 'stroke')
            .on('mouseenter', (d: string) => this.hover = ({type: 'middle-yes', classifier: d}))
            .on('mouseleave', this.clearHover)
            .on('click', (d: string) => this.select(d, 'middle-yes', 'first'))
            .on('contextmenu', (d: string) => this.select(d, 'middle-yes', 'second')); 
        
        barCells.append('circle')
            .attr('class', 'bar-right-right-circle')
            .attr('cx', barWidth/2 - barWidth/4)
            .attr('cy', (d: string) => y(1)+barWidth/8)
            .attr('r',barWidth/8)
            .attr('fill', this.rightColor)
            .attr('stroke', 'grey')
            .style('paint-order', 'stroke')
            .on('mouseenter', (d: string) => this.hover = ({type: 'right_right', classifier: d}))
            .on('mouseleave', this.clearHover)
            .on('click', (d: string) => this.select(d, 'right_right', 'first'))
            .on('contextmenu', (d: string) => this.select(d, 'right_right', 'second'))
            .attr("visibility",(d: string) => (this.height - y(predictions[d].tp / predictions[d].total_size)) > 0
                                          && (this.height - y(predictions[d].tp / predictions[d].total_size)) < barWidth/4?"visible":"hidden")
            ;
        
        barCells.append('circle')
            .attr('class', 'bar-right-wrong-circle')
            .attr('cx',barWidth/2 )
            .attr('cy', (d: string) => this.height - y((predictions[d].tp) / predictions[d].total_size)+barWidth/8)
            .attr('r',barWidth/8)
            .attr('fill', this.wrongColor)
            .attr('stroke', 'grey')
            .style('paint-order', 'stroke')
            .on('mouseenter', (d: string) => this.hover = ({type: 'right_wrong', classifier: d}))
            .on('mouseleave', this.clearHover)
            .on('click', (d: string) => this.select(d, 'right_wrong', 'first'))
            .on('contextmenu', (d: string) => this.select(d, 'right_wrong', 'second'))
            .attr("visibility",(d: string) => (this.height - y(predictions[d].fn / predictions[d].total_size)) > 0
                                          && (this.height - y(predictions[d].fn / predictions[d].total_size)) < barWidth/4?"visible":"hidden")
            ;
        

        barCells.append('circle')
          .attr('class', 'bar-wrong-wrong-circle')
          .attr('cx',barWidth/2- barWidth/4)
            .attr('cy', (d: string) => this.height - y((predictions[d].right_size + predictions[d].middle_right_size+predictions[d].middle_wrong_size) / predictions[d].total_size)+barWidth/8)
            .attr('r',barWidth/8)
            .attr('fill', this.rightColor)
            .attr('stroke', 'grey')
            .style('paint-order', 'stroke')
          .on('mouseenter', (d: string) => this.hover = ({type: 'wrong_wrong', classifier: d}))
          .on('mouseleave', this.clearHover) 
          .on('click', (d: string) => this.select(d, 'wrong_wrong', 'first'))
          .on('contextmenu', (d: string) => this.select(d, 'wrong_wrong', 'second'))
          .attr("visibility",(d: string) => (this.height - y(predictions[d].tn / predictions[d].total_size)) > 0
                                          && (this.height - y(predictions[d].tn / predictions[d].total_size)) < barWidth/4?"visible":"hidden")
            ;

        barCells.append('circle')
          .attr('class', 'bar-wrong-right-circle')
          .attr('cx',barWidth/2)
            .attr('cy', (d: string) => y(0)-barWidth/8)
            .attr('r',barWidth/8)
            .attr('fill', this.wrongColor)
            .attr('stroke', 'grey')
            .style('paint-order', 'stroke')
          .on('mouseenter', (d: string) => this.hover = ({type: 'wrong_right', classifier: d}))
          .on('mouseleave', this.clearHover) 
          .on('click', (d: string) => this.select(d, 'wrong_right', 'first'))
          .on('contextmenu', (d: string) => this.select(d, 'wrong_right', 'second'))
          .attr("visibility",(d: string) => (this.height - y(predictions[d].fp / predictions[d].total_size)) > 0
                                          && (this.height - y(predictions[d].fp / predictions[d].total_size)) < barWidth/4?"visible":"hidden")
            ;
       

        barCells.append('circle')
            .attr('class', 'bar-middle-yes-circle')
            .attr('cx',barWidth/2 + barWidth/4)
            .attr('cy', ((d: string) => this.height - y((predictions[d].right_size+predictions[d].middle_right_size+predictions[d].middle_wrong_size) / predictions[d].total_size)-barWidth/8))
            .attr('r',barWidth/8)
            .attr('fill', "lightgrey")
            .attr('stroke', 'grey')
            .style('paint-order', 'stroke')
            .attr("visibility",(d: string) => (this.height - y((predictions[d].middle_right_size+predictions[d].middle_wrong_size) / predictions[d].total_size)) > 0
                                          && (this.height - y((predictions[d].middle_right_size+predictions[d].middle_wrong_size) / predictions[d].total_size)) < barWidth/4?"visible":"hidden")

            .on('mouseenter', (d: string) => this.hover = ({type: 'middle-yes', classifier: d}))
            .on('mouseleave', this.clearHover)
            .on('click', (d: string) => this.select(d, 'middle-yes', 'first'))
            .on('contextmenu', (d: string) => this.select(d, 'middle-yes', 'second')); 
      };

      const drawDistributeBars = () => {
        const barCells = svg.selectAll('.cell')
          .data(this.continuousPredictionKeys)
          .join('g')
            .attr('class', 'cell')
            .attr('transform', function (d: string){ 
              return `translate(${x(d)}, ${0})`});

        this.svg = svg;
        const barWidth = x.bandwidth();

        barCells.append('rect')
            .attr('class', 'bar-right-right')
            .attr('y', (d: string) => y(1))
            .attr('width', function(d){
              return barWidth
              })
            .attr('height', (d: string) => this.distribution_mode == 'correctness'? this.height - y(predictions[d].tp / predictions[d].total_size)
                                                                                  : this.height - y((predictions[d].tp + predictions[d].m_tp) / predictions[d].total_size))
            .attr('fill', this.rightColor)
            .attr('stroke', 'black')
            .style('paint-order', 'stroke')
            .on('mouseenter', (d: string) => this.hover = ({type: 'right_right', classifier: d}))
            .on('mouseleave', this.clearHover)
            .on('click', (d: string) => this.select(d, 'right_right', 'first'))
            .on('contextmenu', (d: string) => this.select(d, 'right_right', 'second'));
        

        barCells.append('rect')
          .attr('class', 'bar-wrong-wrong')
          .attr('y', (d: string) => this.distribution_mode == 'correctness'?  this.height - y((predictions[d].tp) / predictions[d].total_size)
                                                                              :this.height - y((predictions[d].tp + predictions[d].m_tp) / predictions[d].total_size))
          .attr('width', barWidth)
          .attr('height', (d: string) => this.distribution_mode == 'correctness'?  this.height - y(predictions[d].tn / predictions[d].total_size)
                                                                                  :this.height - y((predictions[d].tn + predictions[d].m_tn) / predictions[d].total_size))
          .attr('fill', this.rightColor)
          .attr('stroke', 'black')
          .style('paint-order', 'stroke')
          .on('mouseenter', (d: string) => this.hover = ({type: 'wrong_wrong', classifier: d}))
          .on('mouseleave', this.clearHover) 
          .on('click', (d: string) => this.select(d, 'wrong_wrong', 'first'))
          .on('contextmenu', (d: string) => this.select(d, 'wrong_wrong', 'second'));

        barCells.append('rect')
            .attr('class', 'bar-right-wrong')
            .attr('y', (d: string) =>this.distribution_mode == 'correctness'?  this.height - y((predictions[d].tp + predictions[d].tn + predictions[d].middle_right_size+predictions[d].middle_wrong_size) / predictions[d].total_size)
                                                                             : this.height - y((predictions[d].tp + predictions[d].tn + predictions[d].m_tp+predictions[d].m_tn) / predictions[d].total_size))
            .attr('width', function(d){
              return barWidth
              })
            .attr('height', (d: string) =>this.distribution_mode == 'correctness'?  this.height - y(predictions[d].fn / predictions[d].total_size)
                                                                                  :  this.height - y((predictions[d].fn + predictions[d].m_fp) / predictions[d].total_size))
            .attr('fill', this.wrongColor)
            .attr('stroke', 'black')
            .style('paint-order', 'stroke')
            .on('mouseenter', (d: string) => this.hover = ({type: 'right_wrong', classifier: d}))
            .on('mouseleave', this.clearHover)
            .on('click', (d: string) => this.select(d, 'right_wrong', 'first'))
            .on('contextmenu', (d: string) => this.select(d, 'right_wrong', 'second'));
        

        barCells.append('rect')
          .attr('class', 'bar-wrong-right')
          .attr('y', (d: string) =>this.distribution_mode == 'correctness'?  y(predictions[d].fp / predictions[d].total_size)
                                                                            :y((predictions[d].fp + predictions[d].m_fn) / predictions[d].total_size))
          .attr('width', barWidth)
          .attr('height', (d: string) => this.distribution_mode == 'correctness'? this.height - y(predictions[d].fp / predictions[d].total_size)
                                                                                : this.height - y((predictions[d].fp + predictions[d].m_fn) / predictions[d].total_size))
          .attr('fill', this.wrongColor)
          .attr('stroke', 'black')
          .style('paint-order', 'stroke')
          .on('mouseenter', (d: string) => this.hover = ({type: 'wrong_right', classifier: d}))
          .on('mouseleave', this.clearHover) 
          .on('click', (d: string) => this.select(d, 'wrong_right', 'first'))
          .on('contextmenu', (d: string) => this.select(d, 'wrong_right', 'second'));
        
        if (this.distribution_mode == 'correctness') {
          barCells.append('rect')
            .attr('class', 'bar-middle-yes')
            .attr('y', (d: string) => this.height - y((predictions[d].tp + predictions[d].tn) / predictions[d].total_size))
            .attr('width', function(d){
              return barWidth
              })
            .attr('height', (d: string) => this.height - y((predictions[d].middle_right_size+predictions[d].middle_wrong_size) / predictions[d].total_size))
            .attr('fill', "lightgrey")
            .attr('stroke', 'black')
            .style('paint-order', 'stroke')
            .on('mouseenter', (d: string) => this.hover = ({type: 'middle-yes', classifier: d}))
            .on('mouseleave', this.clearHover)
            .on('click', (d: string) => this.select(d, 'middle-yes', 'first'))
            .on('contextmenu', (d: string) => this.select(d, 'middle-yes', 'second')); 
        }
        
        
        barCells.append('circle')
            .attr('class', 'bar-right-right-circle')
            .attr('cx',barWidth/2 - barWidth/4)
            .attr('cy', (d: string) => y(1)+barWidth/8)
            .attr('r',barWidth/8)
            .attr('fill', this.rightColor)
            .attr('stroke', 'grey')
            .style('paint-order', 'stroke')
            .on('mouseenter', (d: string) => this.hover = ({type: 'right_right', classifier: d}))
            .on('mouseleave', this.clearHover)
            .on('click', (d: string) => this.select(d, 'right_right', 'first'))
            .on('contextmenu', (d: string) => this.select(d, 'right_right', 'second'))
            .attr("visibility",(d: string) => (this.height - y(predictions[d].tp / predictions[d].total_size)) > 0
                                          && (this.height - y(predictions[d].tp / predictions[d].total_size)) < barWidth/4?"visible":"hidden")
            ;
        
        barCells.append('circle')
            .attr('class', 'bar-right-wrong-circle')
            .attr('cx',barWidth/2 - barWidth / 4)
            .attr('cy', (d: string) =>this.distribution_mode == 'correctness'?  this.height - y((predictions[d].tp + predictions[d].tn + predictions[d].middle_right_size+predictions[d].middle_wrong_size) / predictions[d].total_size)
                                                                             : this.height - y((predictions[d].tp + predictions[d].tn + predictions[d].m_tp+predictions[d].m_tn) / predictions[d].total_size))
            .attr('r',barWidth/8)
            .attr('fill', this.wrongColor)
            .attr('stroke', 'grey')
            .style('paint-order', 'stroke')
            .on('mouseenter', (d: string) => this.hover = ({type: 'right_wrong', classifier: d}))
            .on('mouseleave', this.clearHover)
            .on('click', (d: string) => this.select(d, 'right_wrong', 'first'))
            .on('contextmenu', (d: string) => this.select(d, 'right_wrong', 'second'))
            .attr("visibility",(d: string) => (this.height - y(predictions[d].fn / predictions[d].total_size)) > 0
                                          && (this.height - y(predictions[d].fn / predictions[d].total_size)) < barWidth/4?"visible":"hidden")
            ;
        

        barCells.append('circle')
          .attr('class', 'bar-wrong-wrong-circle')
          .attr('cx',barWidth/2)
          .attr('cy', (d: string) => this.distribution_mode == 'correctness'?  this.height - y((predictions[d].tp) / predictions[d].total_size)
                                                                              :this.height - y((predictions[d].tp + predictions[d].m_tp) / predictions[d].total_size))

            .attr('r',barWidth/8)
            .attr('fill', this.rightColor)
            .attr('stroke', 'grey')
            .style('paint-order', 'stroke')
          .on('mouseenter', (d: string) => this.hover = ({type: 'wrong_wrong', classifier: d}))
          .on('mouseleave', this.clearHover) 
          .on('click', (d: string) => this.select(d, 'wrong_wrong', 'first'))
          .on('contextmenu', (d: string) => this.select(d, 'wrong_wrong', 'second'))
          .attr("visibility",(d: string) => (this.height - y(predictions[d].tn / predictions[d].total_size)) > 0
                                          && (this.height - y(predictions[d].tn / predictions[d].total_size)) < barWidth/4?"visible":"hidden")
            ;

        barCells.append('circle')
          .attr('class', 'bar-wrong-right-circle')
          .attr('cx',barWidth/2)
            .attr('cy', (d: string) => y(0)-barWidth/8)
            .attr('r',barWidth/8)
            .attr('fill', this.wrongColor)
            .attr('stroke', 'grey')
            .style('paint-order', 'stroke')
          .on('mouseenter', (d: string) => this.hover = ({type: 'wrong_right', classifier: d}))
          .on('mouseleave', this.clearHover) 
          .on('click', (d: string) => this.select(d, 'wrong_right', 'first'))
          .on('contextmenu', (d: string) => this.select(d, 'wrong_right', 'second'))
          .attr("visibility",(d: string) => (this.height - y(predictions[d].fp / predictions[d].total_size)) > 0
                                          && (this.height - y(predictions[d].fp / predictions[d].total_size)) < barWidth/4?"visible":"hidden")
            ;
       
        if (this.distribution_mode == 'correctness') {
            barCells.append('circle')
              .attr('class', 'bar-middle-yes-circle')
              .attr('cx',barWidth/2 + barWidth/4)
              .attr('cy', (d: string) => this.height - y((predictions[d].tp + predictions[d].tn) / predictions[d].total_size))
              .attr('r',barWidth/8)
              .attr('fill', "lightgrey")
              .attr('stroke', 'grey')
              .style('paint-order', 'stroke')
              .attr("visibility",(d: string) => (this.height - y((predictions[d].middle_right_size+predictions[d].middle_wrong_size) / predictions[d].total_size)) > 0
                                            && (this.height - y((predictions[d].middle_right_size+predictions[d].middle_wrong_size) / predictions[d].total_size)) < barWidth/4?"visible":"hidden")

              .on('mouseenter', (d: string) => this.hover = ({type: 'middle-yes', classifier: d}))
              .on('mouseleave', this.clearHover)
              .on('click', (d: string) => this.select(d, 'middle-yes', 'first'))
              .on('contextmenu', (d: string) => this.select(d, 'middle-yes', 'second'));
        }
         
      };

      const drawSelectedBars = () => {
        const barCells = svg.selectAll('.cell')
          .data(this.continuousPredictionKeys)
          .join('g')
            .attr('class', 'cell')
            .attr('transform', function (d: string){ 
              return `translate(${x(d)}, ${0})`});

        const barWidth = x.bandwidth();
        const {first, second} = this.selections
        const classifiers = this.continuousPredictionKeys
        let selectedDistribution = []
        if (first){
          selectedDistribution.push(get_selected_distribution('1'))
        }
        if (second) {
          selectedDistribution.push(get_selected_distribution('2'))
        }

        barCells.append('rect')
            .attr('class', 'bar-right-right')
            .attr('y', (d: string) => y(1))
            .attr('width', function(d){
              return barWidth
              })
            .attr('height', (d: string) => this.height - y(predictions[d].tp / this.instances.length))
            .attr('fill', this.rightColor)
            .attr("opacity",0.5)
            .on('mouseenter', (d: string) => this.hover = ({type: 'right_right', classifier: d}))
            .on('mouseleave', this.clearHover)
            

        
        barCells.append('rect')
            .attr('class', 'bar-right-wrong')
            .attr('y', (d: string) => this.height - y((predictions[d].tp) / this.instances.length))
            .attr('width', function(d){
              return barWidth
              })
            .attr('height', (d: string) => this.height - y(predictions[d].fn / this.instances.length))
            .attr('fill', this.wrongColor)
            .attr("opacity",0.5)
            .on('mouseenter', (d: string) => this.hover = ({type: 'right_wrong', classifier: d}))
            .on('mouseleave', this.clearHover)
        

        barCells.append('rect')
          .attr('class', 'bar-wrong-wrong')
          .attr('y', (d: string) =>this.height - y((predictions[d].right_size + predictions[d].middle_right_size+predictions[d].middle_wrong_size) / this.instances.length))
          .attr('width', barWidth)
          .attr('height', (d: string) => this.height - y(predictions[d].tn / this.instances.length))
          .attr('fill', this.rightColor)
            .attr("opacity",0.5)
          .on('mouseenter', (d: string) => this.hover = ({type: 'wrong_wrong', classifier: d}))
          .on('mouseleave', this.clearHover) 

        barCells.append('rect')
          .attr('class', 'bar-wrong-right')
          .attr('y', (d: string) =>y(predictions[d].fp / this.instances.length))
          .attr('width', barWidth)
          .attr('height', (d: string) => this.height - y(predictions[d].fp / this.instances.length))
          .attr('fill', this.wrongColor)
            .attr("opacity",0.5)
          .on('mouseenter', (d: string) => this.hover = ({type: 'wrong_right', classifier: d}))
          .on('mouseleave', this.clearHover) 

        

        barCells.append('rect')
            .attr('class', 'bar-middle-yes')
            .attr('y', (d: string) => this.height - y((predictions[d].right_size) / this.instances.length))
            .attr('width', function(d){
              return barWidth
              })
            .attr('height', (d: string) => this.height - y((predictions[d].middle_right_size+predictions[d].middle_wrong_size) / this.instances.length))
            .attr('fill', "lightgrey")
            .style('paint-order', 'stroke')
            .style("opacity",0.5)
            .on('mouseenter', (d: string) => this.hover = ({type: 'middle-yes', classifier: d}))
            .on('mouseleave', this.clearHover)
            

        selectedDistribution.forEach((distribution)=>{
            barCells.append('rect')
              .attr('class', 'bar-right-right')
              .attr('x', (d: string) => distribution[d].selected_type == '1'?barWidth / 4 : barWidth / 2)
              .attr('y', (d: string) => y((distribution[d].wrong.size + distribution[d].middle_right.size+distribution[d].middle_wrong.size + distribution[d].right_wrong.size + distribution[d].right_right.size) / this.instances.length))
              .attr('width', function(d){
                return barWidth / 4
                })
              .attr('height', (d: string) => this.height - y(distribution[d].right_right.size / this.instances.length))
              .attr('fill', (d: string) => distribution[d].selected_type == '1'? this.selection1Right:this.selection2Right)
              .attr('stroke', 'black')
              .style('paint-order', 'stroke')
              .on('mouseenter', (d: string) => this.hover = ({type: 'right_right',selection: distribution[d].selected_type, classifier: d}))
              .on('mouseleave', this.clearHover)
          
          barCells.append('rect')
              .attr('class', 'bar-right-wrong')
              .attr('x', (d: string) => distribution[d].selected_type == '1'?barWidth / 4 : barWidth / 2)
              .attr('y', (d: string) => y((distribution[d].wrong.size + distribution[d].middle_right.size+distribution[d].middle_wrong.size + distribution[d].right_wrong.size) / this.instances.length))
              .attr('width', function(d){
                return barWidth / 4
                })
              .attr('height', (d: string) => this.height - y(distribution[d].right_wrong.size / this.instances.length))
              .attr('fill', (d: string) => distribution[d].selected_type == '1'? this.selection1Wrong:this.selection2Wrong)
              .attr('stroke', 'black')
              .style('paint-order', 'stroke')
              .on('mouseenter', (d: string) => this.hover = ({type: 'right_wrong', selection: distribution[d].selected_type,classifier: d}))
              .on('mouseleave', this.clearHover)
          

          barCells.append('rect')
            .attr('class', 'bar-wrong-wrong')
            .attr('x', (d: string) => distribution[d].selected_type == '1'?barWidth / 4 : barWidth / 2)
            .attr('y', (d: string) => y((distribution[d].wrong_right.size + distribution[d].wrong_wrong.size) / this.instances.length))
            .attr('width', barWidth / 4)
            .attr('height', (d: string) => this.height - y(distribution[d].wrong_wrong.size / this.instances.length))
            .attr('fill', (d: string) => distribution[d].selected_type == '1'? this.selection1Right:this.selection2Right)
            .attr('stroke', 'black')
            .style('paint-order', 'stroke')
            .on('mouseenter', (d: string) => this.hover = ({type: 'wrong_wrong',selection: distribution[d].selected_type,classifier: d}))
            .on('mouseleave', this.clearHover) 


          barCells.append('rect')
            .attr('class', 'bar-wrong-right')
            .attr('x', (d: string) => distribution[d].selected_type == '1'?barWidth / 4 : barWidth / 2)
            .attr('y', (d: string) =>y(distribution[d].wrong_right.size / this.instances.length))
            .attr('width', barWidth / 4)
            .attr('height', (d: string) => this.height - y(distribution[d].wrong_right.size / this.instances.length))
            .attr('fill', (d: string) => distribution[d].selected_type == '1'? this.selection1Wrong:this.selection2Wrong)
            .attr('stroke', 'black')
            .style('paint-order', 'stroke')
            .on('mouseenter', (d: string) => this.hover = ({type: 'wrong_right', selection: distribution[d].selected_type,classifier: d}))
            .on('mouseleave', this.clearHover) 
          

          barCells.append('rect')
              .attr('class', 'bar-middle-yes')
              .attr('x', (d: string) => distribution[d].selected_type == '1'?barWidth / 4 : barWidth / 2)
              .attr('y', (d: string) => y((distribution[d].wrong.size + distribution[d].middle_right.size+distribution[d].middle_wrong.size) / this.instances.length))
              .attr('width', function(d){
                return barWidth / 4
                })
              .attr('height', (d: string) => this.height - y((distribution[d].middle_right.size+distribution[d].middle_wrong.size) / this.instances.length))
              .attr('fill', (d: string) => distribution[d].selected_type == '1'? this.selection1mid:this.selection2mid)
              .attr('stroke', 'black')
              .style('paint-order', 'stroke')
              .on('mouseenter', (d: string) => this.hover = ({type: 'middle-yes', selection: distribution[d].selected_type,classifier: d}))
              .on('mouseleave', this.clearHover)
          
          
        })

        function get_selected_distribution(selected_type) {
          const selection = selected_type == '1'? first.instances : second.instances
          let selectedDis = {}
          classifiers.forEach((c)=>{
            let right_right = intersection(selection, predictions[c].right_right)
            let right_wrong = intersection(selection, predictions[c].right_wrong)
            let wrong_wrong = intersection(selection, predictions[c].wrong_wrong)
            let wrong_right = intersection(selection, predictions[c].wrong_right)
            let middle_right = intersection(selection, predictions[c].middle_right)
            let middle_wrong = intersection(selection, predictions[c].middle_wrong)
            let right = intersection(selection, predictions[c].right)
            let wrong = intersection(selection, predictions[c].wrong)
            selectedDis[c]  ={
              'right_right':right_right,
              'right_wrong':right_wrong,
              'wrong_wrong':wrong_wrong,
              'wrong_right':wrong_right,
              'middle_right':middle_right,
              'middle_wrong':middle_wrong,
              'right':right,
              'wrong':wrong,
              'selected_type':selected_type
            }
          })
          return selectedDis
        }

      };
      
      const yAxisMarkerLine = () => {
        svg.append('line')
          .attr('class', 'y-axis-marker-line-1')
          .attr('y1', y(1))
          .attr('x2', this.width)
          .attr('y2', y(1))
          .attr('stroke', 'black')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr("opacity", '0.5')
          .attr('pointer-events', 'none');
        svg.append('line')
          .attr('class', 'y-axis-marker-line-2')
          .attr('y1', y(1))
          .attr('x2', this.width)
          .attr('y2', y(1))
          .attr('stroke', 'black')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr("opacity", '0.5')
          .attr('pointer-events', 'none');  

        svg.append('line')
          .attr('class', 'y-axis-marker-line-3')
          .attr('y1', y(1))
          .attr('x2', this.width)
          .attr('y2', y(1))
          .attr('stroke', 'black')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr("opacity", '0.5')
          .attr('pointer-events', 'none'); 
        svg.append('line')
          .attr('class', 'y-axis-marker-line-4')
          .attr('y1', y(1))
          .attr('x2', this.width)
          .attr('y2', y(1))
          .attr('stroke', 'black')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr("opacity", '0.5')
          .attr('pointer-events', 'none'); 

      };

      const yAxisMarkerText = () => {
        svg.append('rect')
          .attr('class', 'y-axis-marker-rect')
          .attr('width', '260')
          .attr('height', '150')
          .attr("x",this.width-this.margin.right-250)
          .attr('fill', "white")
          .attr('stroke',"lightgrey")
          .attr('stroke-width',"2px")
          .attr('pointer-events', 'none')
          .transition()
          .duration(1000)
          .attr('fill-opacity', 0);  

        svg.append('text')
          .attr('class', 'y-axis-marker-text-1')
          .attr('transform', 'translate(' +(this.width-this.margin.right- 250)+ ', 0)') 
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', this.rightHoverColor)
          .attr('pointer-events', 'none');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-2')
          .attr('transform', 'translate(' +(this.width-this.margin.right- 250)+ ', 40)') 
          .attr('font-size', 20)
          .attr('fill', this.distribution_mode == 'score'? this.wrongHoverColor : this.rightHoverColor )
          .attr('pointer-events', 'none');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-3')
          .attr('transform', 'translate(' +(this.width-this.margin.right- 250)+ ', 70)') 
          .attr('font-size', 20)
          .attr('fill', "grey")
          .attr('pointer-events', 'none');  
        svg.append('text')
          .attr('class', 'y-axis-marker-text-4')
          .attr('transform', 'translate(' +(this.width-this.margin.right- 250)+ ', 100)') 
          .attr('font-size', 20)
          .attr('fill', this.distribution_mode == 'score'? this.rightHoverColor : this.wrongHoverColor )
          .attr('pointer-events', 'none');  
        svg.append('text')
          .attr('class', 'y-axis-marker-text-5')
          .attr('transform', 'translate(' +(this.width-this.margin.right- 250)+ ', 130)') 
          .attr('font-size', 20)
          .attr('fill', this.wrongHoverColor)
          .attr('pointer-events', 'none');  

        svg.append('text')
          .attr('class', 'y-axis-marker-text-1-s1')
          .attr('transform', 'translate(' +(this.width-this.margin.right-160)+ ', 0)') 
           
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', "steelblue")
          .attr('pointer-events', 'none');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-2-s1')
          .attr('transform', 'translate(' +(this.width-this.margin.right- 160)+ ', 40)') 
           
          .attr('font-size', 20)
          .attr('fill', "steelblue")
          .attr('pointer-events', 'none');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-3-s1')
          .attr('transform', 'translate(' +(this.width-this.margin.right- 160)+ ', 70)') 
           
          .attr('font-size', 20)
          .attr('fill', "grey")
          .attr('pointer-events', 'none');  
        svg.append('text')
          .attr('class', 'y-axis-marker-text-4-s1')
          .attr('transform', 'translate(' +(this.width-this.margin.right- 160)+ ', 100)') 
           
          .attr('font-size', 20)
          .attr('fill', "steelblue")
          .attr('pointer-events', 'none');  
        svg.append('text')
          .attr('class', 'y-axis-marker-text-5-s1')
          .attr('transform', 'translate(' +(this.width-this.margin.right-160)+ ', 130)') 
           
          .attr('font-size', 20)
          .attr('fill', "steelblue")
          .attr('pointer-events', 'none');  

        svg.append('text')
          .attr('class', 'y-axis-marker-text-1-s2')
          .attr('transform', 'translate(' +(this.width-this.margin.right-70)+ ', 0)') 
           
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', "red")
          .attr('pointer-events', 'none');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-2-s2')
          .attr('transform', 'translate(' +(this.width-this.margin.right-70)+ ', 40)') 
           
          .attr('font-size', 20)
          .attr('fill', "red")
          .attr('pointer-events', 'none');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-3-s2')
          .attr('transform', 'translate(' +(this.width-this.margin.right-70)+ ', 70)') 
           
          .attr('font-size', 20)
          .attr('fill', "grey")
          .attr('pointer-events', 'none');  
        svg.append('text')
          .attr('class', 'y-axis-marker-text-4-s2')
          .attr('transform', 'translate(' +(this.width-this.margin.right-70)+ ', 100)') 
           
          .attr('font-size', 20)
          .attr('fill', "red")
          .attr('pointer-events', 'none');  
        svg.append('text')
          .attr('class', 'y-axis-marker-text-5-s2')
          .attr('transform', 'translate(' +(this.width-this.margin.right-70)+ ', 130)') 
           
          .attr('font-size', 20)
          .attr('fill', "red")
          .attr('pointer-events', 'none');  
      };

      if (this.selection_mode == 'overall') {
        if (this.distribution_mode == 'score') {
          drawBars();
          this.drawSelections();
        } else {
          drawDistributeBars();
          this.drawSelections();
        }
      } else{
        drawSelectedBars();
      }
      
      yAxisMarkerLine();
      yAxisMarkerText();

      this.drawHover();

    },
    drawDistSelections() {
      const chart = d3.select(this.$refs.svg);
      const formatDecimal = d3.format(".1f")
      const selectionWidth = this.x.bandwidth() / 8

      const { first, second } = this.selections;

      const predictions = this.predictions 

      const rightYOffset = (classifierName:string, typeString: string, selection: Set<string>) => {
        const instances = predictions[classifierName][typeString]
        var totalInstances = 0 
        totalInstances = predictions[classifierName].total_size

        const overlappingInstances = intersection(instances, selection);
        const fractionOfTotalInstances = instances.size == 0? 0 :  overlappingInstances.size / instances.size;
        return this.y(fractionOfTotalInstances) ;
      };
      const rightHeight = (classifierName:string, typeString: string, selection: Set<string>) => {
        const instances = predictions[classifierName][typeString]
        return (this.height - rightYOffset(classifierName, typeString,selection))  /5;
      };

      const wrongYOffset = (classifierName:string, typeString: string, selection: Set<string>) => {
        const instances = predictions[classifierName][typeString]
        var totalInstances = 0 
        totalInstances = predictions[classifierName].total_size
        const overlappingInstances = intersection(instances, selection);
        const fractionOfTotalInstances = instances.size == 0? 0 :  overlappingInstances.size / instances.size;
        return this.y(fractionOfTotalInstances) ;
      };
      const wrongHeight = (classifierName:string, typeString: string, selection: Set<string>) => {
        const instances = predictions[classifierName][typeString]
        var totalInstances = 0
        totalInstances = predictions[classifierName].total_size
        const overlappingInstances = intersection(instances, selection);
        const fractionOfTotalInstances = instances.size == 0? 0 :  overlappingInstances.size / instances.size;
        return (this.height - this.y(fractionOfTotalInstances)) /5;
      };

      const middleYesYOffset = (classifierName:string, typeString: string, selection: Set<string>) => {
        const instances = new Set([...predictions[classifierName].middle_right])
        const instancesNo = new Set([ ...predictions[classifierName].middle_wrong]) 
        var totalInstances = 0 
        totalInstances = predictions[classifierName].total_size
        const overlappingInstances = intersection(instances, selection);
        const overlappingInstancesNo = intersection(instancesNo, selection);
        const fractionOfTotalInstances = (instances.size + instancesNo.size) == 0? 0 :  (overlappingInstances.size+overlappingInstancesNo.size+predictions[classifierName].wrong_size ) / (instances.size + instancesNo.size);
        return this.y(fractionOfTotalInstances) ;
      };
      const middleYesHeight = (classifierName:string, typeString: string, selection: Set<string>) => {
        const instances = new Set([...predictions[classifierName].middle_right])
        const instancesNo = new Set([ ...predictions[classifierName].middle_wrong]) 
        var totalInstances = 0
        totalInstances = predictions[classifierName].total_size
        const overlappingInstances = intersection(instances, selection);
        const overlappingInstancesNo = intersection(instancesNo, selection);
        const fractionOfTotalInstances = (instances.size + instancesNo.size) == 0? 0 :(overlappingInstances.size + overlappingInstancesNo.size) / (instances.size + instancesNo.size);
        return (this.height - this.y(fractionOfTotalInstances)) /5;
      };

      const x = this.x;
      const y = this.y;
      const barWidth = x.bandwidth();
      const selectionBarWidth = x.bandwidth() / 8;
      const selectionType =  ['right_right', 'right_wrong', 'wrong_wrong', 'wrong_right', 'middle']
      const selections = [first, second];

      selections.forEach((cur_selection, idx)=>{
        if (!cur_selection) {
          this.svg.selectAll('selection-rect-'+idx).attr('height', '0');
          this.svg.selectAll('selection-circle-'+idx).attr("visibility","hidden");
        } else {
          this.continuousPredictionKeys.forEach((d)=>{
            selectionType.forEach((type, i)=>{
              let selection_attributes = {
                  barCells : this.svg,
                  x : x(d) + barWidth / 2 + (idx-1) * selectionBarWidth ,
                  y : type == 'right_right' ? y(1)
                    : type == 'right_wrong' ? this.height / 5
                    : type == 'wrong_wrong' ? this.height / 5 * 3 
                    : type == 'wrong_right' ?this.height / 5 * 4
                    : this.height / 5 * 2,
                  width : selectionBarWidth,
                  height : type == 'right_right' || type == 'right_wrong' ? rightHeight(d, type, cur_selection.instances) 
                      : type == 'wrong_wrong' || type == 'wrong_right' ? wrongHeight(d, type, cur_selection.instances)
                      : middleYesHeight(d,type, cur_selection.instances),
                  r  : selectionBarWidth / 2,
                  color : idx == 0? this.selection1Color : this.selection2Color,
                  circle_visibility : ((type == 'right_right' || type == 'right_wrong') && rightHeight(d, type, cur_selection.instances) > 0 && rightHeight(d,type, cur_selection.instances) < selectionWidth)
                                    || ((type == 'wrong_wrong' || type == 'wrong_right') && wrongHeight(d,type, cur_selection.instances) > 0 && wrongHeight(d,type, cur_selection.instances) < selectionWidth)
                                    || (middleYesHeight(d,type, cur_selection.instances) > 0 && middleYesHeight(d,type, cur_selection.instances) < selectionWidth) ? "visible":"hidden",
                  cx : x(d) + barWidth / 2  + (idx - 1/2) * selectionBarWidth,
                  cy : type == 'right_right' ? y(1)
                    : type == 'right_wrong' ? this.height / 5
                    : type == 'wrong_wrong' ? this.height / 5 * 3 
                    : type == 'wrong_right' ?this.height / 5 * 4
                    : this.height / 5 * 2,                  
                  selection_type: idx,
                  view_name : this.name
                }
                this.$store.dispatch('drawSelections',selection_attributes)
            })
          })
        }
      })


    },
    drawSelections() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      
      const formatDecimal = d3.format(".1f")
      const selectionWidth = this.x.bandwidth() / 8

      const { first, second } = this.selections;

      const predictions = this.predictions 

      let instanceWeights = {};
      let allInstances = [...this.$store.getters.filteredInstances];
      let selectionHistory = this.$store.state.selectionHistory
      allInstances.forEach((c)=>{
        instanceWeights[c] = 1
      })
      
      if (this.weightedPerformance == 'weighted') {
        selectionHistory.forEach((s)=>{
          let tmp_instances = [...s.instances]

          let weight = parseFloat((s.weight).toString())
          tmp_instances.forEach((i)=>{
            instanceWeights[i] += weight
          })
        })
      }
      
      const weightedInstanceSize = (instances: any[]) => {
        let size = 0
        instances.forEach((i)=>{
          size += instanceWeights[i]
        })
        return size
      }


      const rightYOffset = (classifierName:string, typeString: string, selection: Set<string>) => {
        const instances = predictions[classifierName][typeString]
        const totalInstances =  new Set(this.instances) 
        const overlappingInstances = intersection(instances, selection);
        const fractionOfTotalInstances = weightedInstanceSize([...overlappingInstances]) / weightedInstanceSize([...totalInstances]); 
        return this.y(fractionOfTotalInstances);
      };
      const rightHeight = (classifierName:string, typeString: string, selection: Set<string>) => {
        const instances = predictions[classifierName][typeString]
        return this.height - rightYOffset(classifierName, typeString,selection);
      };

      const wrongYOffset = (classifierName:string, typeString: string, selection: Set<string>) => {
        const instances = predictions[classifierName][typeString]
        const totalInstances = new Set(this.instances) 
        const overlappingInstances = intersection(instances, selection);
        const fractionOfTotalInstances = weightedInstanceSize([...overlappingInstances]) / weightedInstanceSize([...totalInstances]); 
        return this.y(fractionOfTotalInstances);
      };
      const wrongHeight = (classifierName:string, typeString: string, selection: Set<string>) => {
        const instances = predictions[classifierName][typeString]
        const totalInstances = new Set(this.instances) 
        const overlappingInstances = intersection(instances, selection);
        const fractionOfTotalInstances = weightedInstanceSize([...overlappingInstances]) / weightedInstanceSize([...totalInstances]); 
        return this.height - this.y(fractionOfTotalInstances);
      };

      const middleYesYOffset = (classifierName:string, typeString: string, selection: Set<string>) => {
        const instances = new Set([...predictions[classifierName].middle_right])
        const instancesNo = new Set([ ...predictions[classifierName].middle_wrong]) 
        const totalInstances = new Set(this.instances) 
        const overlappingInstances = intersection(instances, selection);
        const overlappingInstancesNo = intersection(instancesNo, selection);
        const fractionOfTotalInstances = (weightedInstanceSize([...overlappingInstances]) + weightedInstanceSize([...overlappingInstancesNo]) + predictions[classifierName].wrong_size)
                                          / (weightedInstanceSize([...totalInstances]))
        return this.y(fractionOfTotalInstances);
      };
      const middleYesHeight = (classifierName:string, typeString: string, selection: Set<string>) => {
        const instances = new Set([...predictions[classifierName].middle_right])
        const instancesNo = new Set([ ...predictions[classifierName].middle_wrong]) 
        const totalInstances = new Set(this.instances) 
        const overlappingInstances = intersection(instances, selection);
        const overlappingInstancesNo = intersection(instancesNo, selection);
        const fractionOfTotalInstances = (weightedInstanceSize([...overlappingInstances]) + weightedInstanceSize([...overlappingInstancesNo])) 
                                          / (weightedInstanceSize([...totalInstances]))
        return this.height - this.y(fractionOfTotalInstances);
      };
      const hasFocusItem = (classifierName:string, typeString: string, selection: Set<string>) => {
        const instances = predictions[classifierName][typeString]
        const overlappingInstances = intersection(instances, selection);
        for (const id of overlappingInstances) {
          if(this.$store.state.focusItemId === id) return true
        }
        return false
      }


      const x = this.x;
      const y = this.y;
      const barWidth = x.bandwidth();
      const selectionBarWidth = x.bandwidth() / 8;
      const selectionType = ['right_right', 'right_wrong', 'wrong_wrong', 'wrong_right', 'middle']
      const selections = [first, second];

      selections.forEach((cur_selection, idx)=>{
        if (!cur_selection) {
          this.svg.selectAll('selection-rect-'+idx).attr('height', '0');
          this.svg.selectAll('selection-circle-'+idx).attr("visibility","hidden");
        } else {
          this.continuousPredictionKeys.forEach((d)=>{
            selectionType.forEach((type, i)=>{
              let vis = 'hidden'
              if (type != 'middle') {
                if ((type == 'right_right' || type == 'right_wrong')) {
                  if (rightHeight(d, type, cur_selection.instances) > 0 && rightHeight(d,type, cur_selection.instances) < selectionWidth) {
                    vis = 'visible'
                  }
                } else if ((type == 'wrong_wrong' || type == 'wrong_right')) {
                  if (wrongHeight(d,type, cur_selection.instances) > 0 && wrongHeight(d,type, cur_selection.instances) < selectionWidth) {
                    vis = 'visible'
                  }
                } 
              } else {
                if (middleYesHeight(d,type, cur_selection.instances) > 0 && middleYesHeight(d,type, cur_selection.instances) < selectionWidth) {
                  vis = 'visible'
                }
                
              }
              
              let selection_attributes = {
                  barCells : this.svg,
                  x : x(d) + barWidth / 2 + (idx-1) * selectionBarWidth ,
                  y : type == 'right_right' ? y(1)
                    : type == 'right_wrong' && this.distribution_mode == 'score' ? this.height - y((predictions[d].tp) / predictions[d].total_size)
                    : type == 'right_wrong' && this.distribution_mode != 'score' ? this.height - y((predictions[d].tp + predictions[d].tn + predictions[d].middle_right_size+predictions[d].middle_wrong_size) / predictions[d].total_size)
                    : type == 'wrong_wrong' && this.distribution_mode == 'score' ? this.height - y((predictions[d].right_size + predictions[d].middle_right_size+predictions[d].middle_wrong_size) / predictions[d].total_size)
                    : type == 'wrong_wrong' && this.distribution_mode != 'score' ? this.height - y((predictions[d].tp) / predictions[d].total_size)
                    : type == 'wrong_right' ? y(predictions[d].fp / predictions[d].total_size)
                    : type == 'middle' && this.distribution_mode == 'score' ? this.height - y((predictions[d].right_size) / predictions[d].total_size)
                    : this.height - y((predictions[d].tp + predictions[d].tn) / predictions[d].total_size),
                  width : selectionBarWidth,
                  height : type == 'right_right' || type == 'right_wrong' ? rightHeight(d, type, cur_selection.instances) 
                      : type == 'wrong_wrong' || type == 'wrong_right' ? wrongHeight(d, type, cur_selection.instances)
                      : middleYesHeight(d,type, cur_selection.instances),
                  r  : selectionBarWidth / 2,
                  color : idx == 0? this.selection1Color : this.selection2Color,
                  circle_visibility: vis,
                  cx : x(d) + barWidth / 2  + (idx - 1/2) * selectionBarWidth,
                  cy : type == 'right_right' ? y(1)
                    : type == 'right_wrong' && this.distribution_mode == 'score' ? this.height - y((predictions[d].tp) / predictions[d].total_size)
                    : type == 'right_wrong' && this.distribution_mode != 'score' ? this.height - y((predictions[d].tp + predictions[d].tn + predictions[d].middle_right_size+predictions[d].middle_wrong_size) / predictions[d].total_size)
                    : type == 'wrong_wrong' && this.distribution_mode == 'score' ? this.height - y((predictions[d].right_size + predictions[d].middle_right_size+predictions[d].middle_wrong_size) / predictions[d].total_size)
                    : type == 'wrong_wrong' && this.distribution_mode != 'score' ? this.height - y((predictions[d].tp) / predictions[d].total_size)
                    : type == 'wrong_right' ? y(predictions[d].fp / predictions[d].total_size)
                    : type == 'middle' && this.distribution_mode == 'score' ? this.height - y((predictions[d].right_size) / predictions[d].total_size)
                    : this.height - y((predictions[d].tp + predictions[d].tn) / predictions[d].total_size),
                  selection_type: idx,
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
      type: 'right' | 'wrong' | 'middle-yes' |'middle-no' | 'middle-curve',
      whichOverlap: 'first' | 'second',
    ) {
      d3.event.preventDefault();
      d3.event.stopPropagation();

      const constraint = blankConstraint();
      constraint.rule = Rule.RIGHT;
      constraint.classifier = classifier;
      constraint.negation = (type === 'wrong');

      let predictions = this.predictions 
      let instances = predictions[classifier][type]
      if (type == "middle-yes"){
        instances = new Set([...predictions[classifier].middle_right].concat([...predictions[classifier].middle_wrong]))
      }
      
      const type_dict = {
        'right_right':'tp',
        'right_wrong':'fn',
        'wrong_wrong':'tn',
        'wrong_right':'fp'
      }
      const description = `Instances which ${classifier} got ${type_dict[type]}`;
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
.card {
  background-color: white;
  display: inline-block
}

    .track-overlay {
      pointer-events: stroke;
      stroke-width: 20px;
    }
    
    /* .slider-circle-time-from, .slider-circle-time-to {
    	cursor: pointer;  
    } */

</style>
