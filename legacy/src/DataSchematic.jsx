import React, { useEffect, useState } from 'react';
import ReactFlow, { MiniMap, Controls } from 'reactflow';
import 'reactflow/dist/style.css';

export default function DataSchematic() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  useEffect(() => {
    fetch('http://localhost:8001/schema')
      .then(res => res.json())
      .then(schema => {
        // Build nodes
        const nodes = schema.tables.map((table, idx) => ({
          id: table.name,
          data: { label: (
            <div>
              <strong>{table.name}</strong>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                {table.fields.map(f => <li key={f}>{f}</li>)}
              </ul>
            </div>
          )},
          position: { x: 200 * idx, y: 100 }
        }));
        // Build edges
        const edges = schema.relationships.map((rel, idx) => ({
          id: `e${rel.from}-${rel.to}-${idx}`,
          source: rel.to,
          target: rel.from,
          label: rel.field
        }));
        setNodes(nodes);
        setEdges(edges);
      });
  }, []);

  return (
    <div style={{ width: '100%', height: 400 }}>
      <ReactFlow nodes={nodes} edges={edges}>
        <MiniMap />
        <Controls />
      </ReactFlow>
    </div>
  );
}