import { Schema, model, Document, Types } from 'mongoose';

export interface IBpmnDocument {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  name: string;
  bpmnXml: string;
  yjsState: Buffer;
  yjsStateVector: Buffer;
  metadata: {
    elementCount: number;
    lastModifiedBy: Types.ObjectId;
    version: number;
    fileSize: number;
  };
  snapshots: Array<{
    id: string;
    name: string;
    yjsState: Buffer;
    createdBy: Types.ObjectId;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBpmnDocumentMethods {
  addSnapshot(name: string, yjsState: Buffer, createdBy: Types.ObjectId): any;
  countBpmnElements(): number;
}

export type BpmnDocumentDocument = Document & IBpmnDocument & IBpmnDocumentMethods;

const snapshotSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  yjsState: {
    type: Buffer,
    required: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const documentSchema = new Schema<IBpmnDocument>({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  bpmnXml: {
    type: String,
    required: true,
    default: '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn"><bpmn:process id="Process_1" isExecutable="false"><bpmn:startEvent id="StartEvent_1"/></bpmn:process><bpmndi:BPMNDiagram id="BPMNDiagram_1"><bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1"><bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1"><dc:Bounds x="173" y="102" width="36" height="36"/></bpmndi:BPMNShape></bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>'
  },
  yjsState: {
    type: Buffer,
    required: false
  },
  yjsStateVector: {
    type: Buffer,
    required: false
  },
  metadata: {
    elementCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastModifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    version: {
      type: Number,
      default: 1,
      min: 1
    },
    fileSize: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  snapshots: [snapshotSchema]
}, {
  timestamps: true
});

// Indexes
documentSchema.index({ projectId: 1, name: 1 }, { unique: true });
documentSchema.index({ 'metadata.lastModifiedBy': 1, updatedAt: -1 });
documentSchema.index({ createdAt: -1 });
documentSchema.index({ name: 'text' });

// Virtual for snapshot count
documentSchema.virtual('snapshotCount').get(function() {
  return this.snapshots?.length || 0;
});

// Method to add snapshot
documentSchema.methods.addSnapshot = function(name: string, yjsState: Buffer, createdBy: Types.ObjectId) {
  const snapshot = {
    id: Date.now().toString(),
    name,
    yjsState,
    createdBy,
    createdAt: new Date()
  };
  
  this.snapshots.push(snapshot);
  
  // Keep only last 20 snapshots
  if (this.snapshots.length > 20) {
    this.snapshots = this.snapshots.slice(-20);
  }
  
  return snapshot;
};

// Method to count BPMN elements
documentSchema.methods.countBpmnElements = function(): number {
  if (!this.bpmnXml) return 0;
  
  const matches = this.bpmnXml.match(/<(bpmn:|bpmn2:)\w+/g);
  return matches ? matches.length : 0;
};

// Pre-save hook to update metadata
documentSchema.pre('save', function(next) {
  if (this.isModified('bpmnXml')) {
    this.metadata.elementCount = (this as any).countBpmnElements();
    this.metadata.fileSize = Buffer.byteLength(this.bpmnXml, 'utf8');
  }
  next();
});

export const BpmnDocument = model<IBpmnDocument>('BpmnDocument', documentSchema);