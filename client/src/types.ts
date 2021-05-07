import { Predicate } from './components/constraints/types';

export interface BoxProps {
  classes: Set<string>;
  classifiers: Set<string>;
  features: Set<string>;
  instances: Set<string>;
  thresholdClassifierNameList: [];
  classifierBandWidthDict:{};
}

export enum EntityType {
  Class =  'class',
  Classifier = 'classifier',
  Instance = 'instance',
}

export type Feature
  = FeatureCategorical
  | FeatureInterval
  | FeatureNominal
  | FeatureOrdinal
  | FeatureRatio;

export interface FeatureCategorical {
  type: 'categorical';
  description: string;
  categories: string[];
}

export interface FeatureInterval {
  type: 'interval';
  description: string;
  bounds?: [number, number];
}

export interface FeatureNominal {
  type: 'nominal';
  description: string;
}

export interface FeatureOrdinal {
  type: 'ordinal';
  description: string;
  categories: string[];
}

export interface FeatureRatio {
  type: 'ratio';
  description: string;
  bounds?: [number, number];
}

export enum FilterAction {
  Set,
  Clear,
  Add,
  Remove,
}

export interface Instance {
  actual: string;
  predictions: {[classifierName: string]: string};
  continuous_predictions: {};
  left_range: {};
  right_range: {};
  features: {[featureName: string]: number | string};
}

export interface InstanceWithId extends Instance {
  id: string;
}

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Metrics {
  actual: {
    [className: string]:  Set<String>,
  };
  predicted: {
    [className: string]:  Set<String>,
  };
  true: {
    [className: string]:  Set<String>,
  };
  false: {
    [className: string]:  Set<String>,
  };
  tp: {
    [className: string]:  Set<String>,
  }
  fp:  {
    [className: string]:  Set<String>,
  }
  fn:  {
    [className: string]:  Set<String>,
  }
  tn:  {
    [className: string]:  Set<String>,
  }
  accuracy: number;
  microf1: {
    average: number,
  };
  macrof1: {
    average: number,
  };
  f1: {
    average: number,
    [className: string]: number,
  };
  precision: {
    average: number,
    [className: string]: number,
  };
  recall: {
    average: number,
    [className: string]: number,
  };
  mcc: {
    average: number,
  }
  acc: {
    average: number,
  }
}

export interface ContinuousMetrics {
  x_roc: {
    [className: string]:  Number[],
  };
  y_roc: {
    [className: string]:  Number[],
  };
  value_roc: {
    [className: string]: Number[],
  };
  x_pr: {
    [className: string]:  Number[],
  };
  y_pr: {
    [className: string]:  Number[],
  }
  line_roc:  {
    [className: string]:  Set<String>,
  }
  line_pr:  {
    [className: string]:  Set<String>,
  }
  auc_area: number;
}

export enum SelectionAction {
  Include = 'include',
  Exclude = 'exclude',
}

export interface SelectionRecord {
  description: string;
  id: number;
  instances: Set<string>;
  name: string;
  size?: number;
  predicate?: Predicate;
  weight: number
}

export interface modelSelectionRecord {
  description: string;
  id: number;
  name: string;
  threshold: number;
}

export interface thresholdSelectionRecord{
  description: string;
  id: number;
  name: string;
  threshold: number;
  classifier: string;
}

export enum SelectionStrategy {
  Any,
  All,
}

export enum SetCompose {
  AND = 'and',
  MINUS = 'minus',
  OR = 'or',
  XOR = 'xor',
}

export interface Visualization {
  boxProps: BoxProps;
  name: VisualizationType;
}

export interface ThresholdWithClassifier {
  classifier: string;
  single_threshold: number;
}

export enum VisualizationType {
  CA = 'Performance_Overall',
  SCP = 'Performance_Selection',
  COV = 'Performance_Per_Class',
  CC = 'Performance_Curves',
  CB = 'Trinary_Performance_Confidence',
  RC = 'Reliability_Curve',
  BA= 'Trinary_Bandwidth_Assessment',
  REC = 'Rejected_Curve',
  TID = 'Trinary_Instance_Distribuion',
  CMG = 'ConfusionMatrixGrid',
  FH = 'Histogram',
  UM = 'UncertaintyHeatMap',
  OCA = 'CumulativeAccuracy',
  PCC = 'PairwiseClassifierConsensus',
  SM = 'MetricsTable',
  SMP = 'MetricsParallel',
  ITL = 'InstanceList',
  SP = 'ScatterPlot',
  FI = 'FocusItem',
}
