// Angular wrapper for @one-million-lines/workflow-builder.
// The package is framework-agnostic; this component wraps the neutral factory.
//
// Remember to add the stylesheet to your angular.json "styles" array:
//   "node_modules/@one-million-lines/workflow-builder/dist/styles.css"
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { createWorkflowBuilder } from "@one-million-lines/workflow-builder";

@Component({
  selector: "wfb-workflow-builder",
  standalone: true,
  template: `<div #host style="width:100%;height:100%;min-height:500px"></div>`,
})
export class WorkflowBuilderComponent implements OnInit, OnDestroy {
  @Input() initialValue: unknown = null;
  @Input() extensions: unknown[] = [];
  @Output() valueChange = new EventEmitter<unknown>();

  @ViewChild("host", { static: true }) host!: ElementRef<HTMLElement>;

  private builder: ReturnType<typeof createWorkflowBuilder> | null = null;

  ngOnInit(): void {
    this.builder = createWorkflowBuilder({
      target: this.host.nativeElement,
      initialValue: this.initialValue as any,
      extensions: this.extensions as any,
      onChange: (wf) => this.valueChange.emit(wf),
    });
  }

  ngOnDestroy(): void {
    this.builder?.destroy();
  }

  getValue() {
    return this.builder?.getValue();
  }
}

// Usage:
// <wfb-workflow-builder [initialValue]="workflow" (valueChange)="onChange($event)" />
