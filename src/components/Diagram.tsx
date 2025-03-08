import React, { useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "@styles/diagram.css";

interface DeleteDialogProps {
  isOpen: boolean;
  nodeId: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

interface Button {
  title: string;
}

interface ChatbotData {
  buttons?: Record<string, Button>;
  keywords?: string[];
  text?: string;
}

interface DiagramProps {
  data: Record<string, ChatbotData>;
}

const DeleteDialog = ({ isOpen, onConfirm, onCancel }: DeleteDialogProps) => {
  if (!isOpen) return null;

  return (
    <div className="delete-dialog-overlay">
      <div className="delete-dialog">
        <h3>Confirm Deletion</h3>
        <p>Are you sure you want to delete this node?</p>
        <div className="delete-dialog-buttons">
          <button className="cancel-button" onClick={onCancel}>
            Cancel
          </button>
          <button className="confirm-button" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// Custom node to display message information
const MessageNode = ({ data }: { data: any }) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = (nodeId: string) => {
    window.location.href = `/${nodeId}`;
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (isDeleting) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/condition/${data.nodeId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Reload the page after successful deletion
        window.location.reload();
      } else {
        const errorText = await response.text();
        console.error("Failed to delete node:", errorText);
        alert("Failed to delete node. Please try again.");
      }
    } catch (error) {
      console.error("Error deleting node:", error);
      alert("An error occurred while deleting the node.");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
  };

  // Check if this is the default node
  const isDefault = data.nodeId === "default";

  return (
    <div className={`message-node ${isDefault ? "default-node" : ""}`}>
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        style={{ background: "#555" }}
      />

      <div className="message-header">
        {data.type === "interactive" ? "Interactive Message" : "Text Message"}
        {isDefault && <span className="default-badge">Default</span>}
        <div className="action-buttons">
          <button
            className="edit-button"
            onClick={() => handleEdit(data.nodeId)}
          >
            Edit
          </button>
          <button
            className={`delete-button ${isDefault ? "delete-disabled" : ""}`}
            onClick={isDefault ? undefined : () => handleDelete()}
            disabled={isDefault}
            title={isDefault ? "Default node cannot be deleted" : "Delete node"}
          >
            Delete
          </button>
        </div>
      </div>
      <div className="message-content">
        <p>{data.text}</p>
        {Array.isArray(data.buttons) && data.buttons.length > 0 && (
          <div className="buttons-list">
            <p>
              <strong>Next steps:</strong>
            </p>
            <ul>
              {data.buttons.map((button: { id: string; title: string }) => (
                <li key={button.id}>{button.title}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {Array.isArray(data.keywords) && data.keywords.length > 0 && (
        <div className="triggers">
          <p>
            <strong>Keywords:</strong> {data.keywords.join(", ")}
          </p>
        </div>
      )}
      <DeleteDialog
        isOpen={showDeleteDialog}
        nodeId={data.nodeId}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
        style={{ background: "#555" }}
      />
    </div>
  );
};

const nodeTypes = {
  messageNode: MessageNode,
} as const;

export default function Diagram({ data }: DiagramProps) {
  // Add state to track if layout has changed
  const [layoutChanged, setLayoutChanged] = useState(false);
  const [savedPositions, setSavedPositions] = useState<Record<
    string,
    { position: { x: number; y: number } }
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize nodes and edges with empty arrays
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);

  // Fetch saved layout on component mount
  useEffect(() => {
    const fetchSavedLayout = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/layout");
        if (response.ok) {
          const layoutData = await response.json();
          // Handle nested nodePositions structure
          const positions =
            layoutData.nodePositions?.nodePositions ||
            layoutData.nodePositions ||
            null;
          setSavedPositions(positions);
        }
      } catch (error) {
        console.error("Error fetching layout:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSavedLayout().then(() => {
      // Set loading to false after fetching layout
      setIsLoading(false);
    });
  }, []);

  // Process data and update nodes/edges after loading completes
  useEffect(() => {
    if (!isLoading) {
      const { nodes: initialNodes, edges: initialEdges } = processFlowData();
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [isLoading, data, savedPositions]);

  // Process the flow data to create nodes and edges
  const processFlowData = () => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Safety check - if data is null or undefined
    if (!data) {
      return { nodes, edges };
    }

    // First, create all nodes with default positions
    Object.entries(data).forEach(([nodeId, nodeData]) => {
      // Convert buttons object to array format needed by MessageNode
      const buttonsArray = nodeData.buttons
        ? Object.entries(nodeData.buttons).map(([id, button]) => ({
            id,
            title: button.title,
          }))
        : [];

      nodes.push({
        id: nodeId,
        position: { x: 0, y: 0 }, // Initial positions will be updated later
        data: {
          text: nodeData.text || "",
          type: buttonsArray.length > 0 ? "interactive" : "text",
          buttons: buttonsArray,
          keywords: nodeData.keywords || [],
          nodeId: nodeId,
        },
        type: "messageNode",
        style: {
          background: "#f5f5f5",
          padding: "20px",
          borderRadius: "5px",
          border: "1px solid #ddd",
          width: 400,
        },
      });
    });

    // Now position the nodes - either from saved layout or calculate new layout
    const nodePositions = savedPositions || calculateTreeLayout();

    // Apply calculated positions with improved logging and error handling
    nodes.forEach((node) => {
      const positionData = nodePositions?.[node.id];

      if (positionData) {
        if ("position" in positionData) {
          node.position = positionData.position;
        } else {
          node.position = { x: positionData.x, y: positionData.y };
        }
      } else {
        // Apply a default grid position if nothing else works
        const index = nodes.findIndex((n) => n.id === node.id);
        node.position = {
          x: (index % 3) * 300,
          y: Math.floor(index / 3) * 200,
        };
      }
    });

    // Create edges with proper handle IDs
    Object.entries(data).forEach(([sourceId, sourceData]) => {
      if (sourceData.buttons) {
        Object.entries(sourceData.buttons).forEach(([targetId, button]) => {
          if (data[targetId]) {
            edges.push({
              id: `edge-${sourceId}-to-${targetId}`,
              source: sourceId,
              target: targetId,
              sourceHandle: "source", // Connect to the source handle
              targetHandle: "target", // Connect to the target handle
              label: button.title || "",
              style: {
                stroke: "#2196F3",
                strokeWidth: 2,
              },
            });
          }
        });
      }
    });

    return { nodes, edges };
  };

  // Add this function to calculate a tree layout when no saved positions exist
  const calculateTreeLayout = () => {
    const positions: Record<string, { x: number; y: number }> = {};
    const nodeIDs = Object.keys(data);

    // Simple tree layout implementation - place nodes in a grid
    const columns = Math.ceil(Math.sqrt(nodeIDs.length));
    const spacing = 250;

    nodeIDs.forEach((id, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      positions[id] = {
        x: col * spacing * 1.5,
        y: row * spacing,
      };
    });

    return positions;
  };

  // Add save layout functionality
  const saveLayout = async () => {
    try {
      const currentPositions: Record<
        string,
        { position: { x: number; y: number } }
      > = {};

      nodes.forEach((node) => {
        currentPositions[node.id] = {
          position: { x: node.position.x, y: node.position.y },
        };
      });

      const response = await fetch("/api/layout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nodePositions: currentPositions }),
      });

      if (response.ok) {
        setLayoutChanged(false);
        setSavedPositions(currentPositions);
        alert("Layout saved successfully!");
      } else {
        alert("Failed to save layout.");
      }
    } catch (error) {
      console.error("Error saving layout:", error);
      alert("Error saving layout: " + error);
    }
  };

  // Add new element handler
  const handleAddNewElement = () => {
    if (Object.keys(data).length === 0) {
      window.location.href = `/default`;
    } else {
      const newId = Date.now().toString();
      window.location.href = `/${newId}`;
    }
  };

  // Track node drag events to detect layout changes
  const onNodeDragStop = () => {
    setLayoutChanged(true);
  };

  if (isLoading) {
    return (
      <div
        style={{
          width: "100%",
          height: "800px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <p>Loading diagram...</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "800px", position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background />
        <Controls />
        <MiniMap />
        <Panel position="top-right" className="panel-buttons">
          <button
            className="reset-button"
            onClick={() => {
              const { nodes: layoutedNodes, edges: layoutedEdges } =
                processFlowData();
              setNodes(layoutedNodes);
              setEdges(layoutedEdges);
              setLayoutChanged(false);
            }}
          >
            Reset Layout
          </button>
          <button
            className={`save-button ${layoutChanged ? "save-needed" : ""}`}
            onClick={saveLayout}
            disabled={!layoutChanged}
          >
            Save Layout
          </button>
        </Panel>
      </ReactFlow>

      <button className="add-button" onClick={handleAddNewElement}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>
  );
}
