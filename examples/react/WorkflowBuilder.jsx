// React wrapper for @one-million-lines/workflow-builder.
//
// The package is framework-agnostic, so React integration is a thin wrapper
// around the framework-neutral factory. React/ReactDOM are NOT dependencies of
// the package — this file lives in the consuming app.
import { useEffect, useRef } from "react";
import { createWorkflowBuilder } from "@one-million-lines/workflow-builder";
import "@one-million-lines/workflow-builder/styles.css";

export function WorkflowBuilder({ initialValue, registries, extensions, dataProvider, onChange }) {
  const hostRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    const builder = createWorkflowBuilder({
      target: hostRef.current,
      initialValue,
      registries,
      extensions,
      dataProvider,
      onChange,
    });
    instanceRef.current = builder;
    return () => builder.destroy();
    // Mount once; updates flow through the onChange callback / imperative ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} style={{ width: "100%", height: "100%", minHeight: 500 }} />;
}

// Usage:
//
// function App() {
//   return (
//     <WorkflowBuilder
//       initialValue={{ trigger: { type: null, config: {} }, steps: [] }}
//       onChange={(wf) => console.log(wf)}
//     />
//   );
// }
