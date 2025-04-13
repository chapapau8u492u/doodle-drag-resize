
// Main application state
const state = {
    mode: 'move', // 'move' or 'draw'
    isDrawing: false,
    isDragging: false,
    images: [],
    activeImageIndex: -1,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    resizing: false,
    resizeHandle: null,
    brushColor: '#000000',
    brushSize: 5,
    paths: []
};

// Canvas and context
let canvas;
let ctx;

// DOM Elements
let drawOptions;
let brushSizeInput;
let brushColorInput;
let sizeValue;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize canvas
    canvas = document.getElementById('main-canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    
    // Get UI elements
    drawOptions = document.querySelector('.draw-options');
    brushSizeInput = document.getElementById('brush-size');
    brushColorInput = document.getElementById('brush-color');
    sizeValue = document.getElementById('size-value');
    
    // Set up event listeners
    document.getElementById('image-upload').addEventListener('change', handleImageUpload);
    document.getElementById('draw-tool').addEventListener('click', () => setMode('draw'));
    document.getElementById('move-tool').addEventListener('click', () => setMode('move'));
    document.getElementById('clear-canvas').addEventListener('click', clearCanvas);
    brushSizeInput.addEventListener('input', updateBrushSize);
    brushColorInput.addEventListener('input', updateBrushColor);
    
    // Canvas event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    
    // Touch events for mobile
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleTouchEnd);
    
    // Handle window resize
    window.addEventListener('resize', resizeCanvas);
});

// Resize canvas to fill container
function resizeCanvas() {
    const container = document.querySelector('.canvas-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    redrawCanvas();
}

// Set the current tool mode
function setMode(mode) {
    state.mode = mode;
    
    // Update UI
    document.getElementById('draw-tool').classList.toggle('active', mode === 'draw');
    document.getElementById('move-tool').classList.toggle('active', mode === 'move');
    drawOptions.style.display = mode === 'draw' ? 'flex' : 'none';
    canvas.classList.toggle('drawing', mode === 'draw');
    
    // Hide resize handles when in draw mode
    updateResizeHandles();
}

// Update brush size from slider
function updateBrushSize() {
    state.brushSize = parseInt(brushSizeInput.value);
    sizeValue.textContent = `${state.brushSize}px`;
}

// Update brush color from color picker
function updateBrushColor() {
    state.brushColor = brushColorInput.value;
}

// Handle image file upload
function handleImageUpload(e) {
    const file = e.target.files[0];
    
    if (file && file.type.match('image.*')) {
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                // Size the image proportionally to fit on canvas
                let width = img.width;
                let height = img.height;
                const maxDim = Math.min(canvas.width, canvas.height) * 0.7;
                
                if (width > height && width > maxDim) {
                    height = (height / width) * maxDim;
                    width = maxDim;
                } else if (height > maxDim) {
                    width = (width / height) * maxDim;
                    height = maxDim;
                }
                
                // Center the image on canvas
                const x = (canvas.width - width) / 2;
                const y = (canvas.height - height) / 2;
                
                // Add image to state
                state.images.push({
                    img: img,
                    x: x,
                    y: y,
                    width: width,
                    height: height
                });
                
                state.activeImageIndex = state.images.length - 1;
                
                // Switch to move mode automatically
                setMode('move');
                
                // Draw the image
                redrawCanvas();
                updateResizeHandles();
                
                // Clear the input so the same file can be selected again
                e.target.value = '';
            };
            img.src = event.target.result;
        };
        
        reader.readAsDataURL(file);
    }
}

// Clear all canvas content
function clearCanvas() {
    if (confirm('Are you sure you want to clear the canvas? This will remove all images and drawings.')) {
        state.images = [];
        state.paths = [];
        state.activeImageIndex = -1;
        redrawCanvas();
        updateResizeHandles();
    }
}

// Mouse event handlers
function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (state.mode === 'draw') {
        startDrawing(x, y);
    } else if (state.mode === 'move') {
        // Check if clicking on a resize handle
        const handleClicked = checkResizeHandles(x, y);
        
        if (handleClicked) {
            state.resizing = true;
            state.resizeHandle = handleClicked;
            state.startX = x;
            state.startY = y;
            return;
        }
        
        // Check if clicking on an image
        const imageIndex = getImageAtPosition(x, y);
        
        if (imageIndex !== -1) {
            state.activeImageIndex = imageIndex;
            state.isDragging = true;
            state.startX = x;
            state.startY = y;
            state.offsetX = x - state.images[imageIndex].x;
            state.offsetY = y - state.images[imageIndex].y;
            updateResizeHandles();
        } else {
            state.activeImageIndex = -1;
            updateResizeHandles();
        }
    }
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (state.mode === 'draw' && state.isDrawing) {
        continueDrawing(x, y);
    } else if (state.mode === 'move') {
        if (state.resizing && state.activeImageIndex !== -1) {
            resizeImage(x, y);
        } else if (state.isDragging && state.activeImageIndex !== -1) {
            dragImage(x, y);
        }
    }
}

function handleMouseUp() {
    if (state.mode === 'draw' && state.isDrawing) {
        stopDrawing();
    } else if (state.mode === 'move') {
        state.isDragging = false;
        state.resizing = false;
        state.resizeHandle = null;
    }
}

// Touch event handlers (for mobile)
function handleTouchStart(e) {
    e.preventDefault(); // Prevent scrolling
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // Simulate mouse down
        if (state.mode === 'draw') {
            startDrawing(x, y);
        } else if (state.mode === 'move') {
            // Check if touching a resize handle
            const handleClicked = checkResizeHandles(x, y);
            
            if (handleClicked) {
                state.resizing = true;
                state.resizeHandle = handleClicked;
                state.startX = x;
                state.startY = y;
                return;
            }
            
            // Check if touching an image
            const imageIndex = getImageAtPosition(x, y);
            
            if (imageIndex !== -1) {
                state.activeImageIndex = imageIndex;
                state.isDragging = true;
                state.startX = x;
                state.startY = y;
                state.offsetX = x - state.images[imageIndex].x;
                state.offsetY = y - state.images[imageIndex].y;
                updateResizeHandles();
            } else {
                state.activeImageIndex = -1;
                updateResizeHandles();
            }
        }
    }
}

function handleTouchMove(e) {
    e.preventDefault(); // Prevent scrolling
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // Simulate mouse move
        if (state.mode === 'draw' && state.isDrawing) {
            continueDrawing(x, y);
        } else if (state.mode === 'move') {
            if (state.resizing && state.activeImageIndex !== -1) {
                resizeImage(x, y);
            } else if (state.isDragging && state.activeImageIndex !== -1) {
                dragImage(x, y);
            }
        }
    }
}

function handleTouchEnd(e) {
    // Simulate mouse up
    if (state.mode === 'draw' && state.isDrawing) {
        stopDrawing();
    } else if (state.mode === 'move') {
        state.isDragging = false;
        state.resizing = false;
        state.resizeHandle = null;
    }
}

// Drawing functions
function startDrawing(x, y) {
    state.isDrawing = true;
    
    // Start a new path
    const newPath = {
        color: state.brushColor,
        size: state.brushSize,
        points: [{x, y}]
    };
    
    state.paths.push(newPath);
    
    // Draw the initial point
    ctx.beginPath();
    ctx.arc(x, y, state.brushSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = state.brushColor;
    ctx.fill();
}

function continueDrawing(x, y) {
    if (!state.isDrawing) return;
    
    // Get current path and add new point
    const currentPath = state.paths[state.paths.length - 1];
    currentPath.points.push({x, y});
    
    const lastPoint = currentPath.points[currentPath.points.length - 2];
    
    // Draw line from last point to current point
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(x, y);
    ctx.lineWidth = state.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = state.brushColor;
    ctx.stroke();
}

function stopDrawing() {
    state.isDrawing = false;
}

// Image manipulation functions
function getImageAtPosition(x, y) {
    // Check in reverse order (top-most image first)
    for (let i = state.images.length - 1; i >= 0; i--) {
        const img = state.images[i];
        if (
            x >= img.x && 
            x <= img.x + img.width && 
            y >= img.y && 
            y <= img.y + img.height
        ) {
            return i;
        }
    }
    return -1;
}

function dragImage(x, y) {
    const img = state.images[state.activeImageIndex];
    img.x = x - state.offsetX;
    img.y = y - state.offsetY;
    redrawCanvas();
    updateResizeHandles();
}

// Check if a point is over a resize handle
function checkResizeHandles(x, y) {
    if (state.activeImageIndex === -1) return null;
    
    const img = state.images[state.activeImageIndex];
    const handleSize = 10; // Size of the handle (should match CSS)
    
    // Check each handle
    if (isPointInRect(x, y, img.x - handleSize/2, img.y - handleSize/2, handleSize, handleSize)) {
        return 'top-left';
    }
    if (isPointInRect(x, y, img.x + img.width - handleSize/2, img.y - handleSize/2, handleSize, handleSize)) {
        return 'top-right';
    }
    if (isPointInRect(x, y, img.x - handleSize/2, img.y + img.height - handleSize/2, handleSize, handleSize)) {
        return 'bottom-left';
    }
    if (isPointInRect(x, y, img.x + img.width - handleSize/2, img.y + img.height - handleSize/2, handleSize, handleSize)) {
        return 'bottom-right';
    }
    
    return null;
}

function isPointInRect(x, y, rectX, rectY, rectWidth, rectHeight) {
    return x >= rectX && x <= rectX + rectWidth && y >= rectY && y <= rectY + rectHeight;
}

function resizeImage(x, y) {
    const img = state.images[state.activeImageIndex];
    const originalRatio = img.img.width / img.img.height;
    const deltaX = x - state.startX;
    const deltaY = y - state.startY;
    
    // Update state for next move
    state.startX = x;
    state.startY = y;
    
    switch (state.resizeHandle) {
        case 'top-left':
            img.width -= deltaX;
            img.height = img.width / originalRatio;
            img.x += deltaX;
            img.y = img.y + (deltaX / originalRatio);
            break;
            
        case 'top-right':
            img.width += deltaX;
            img.height = img.width / originalRatio;
            img.y = img.y - (deltaX / originalRatio);
            break;
            
        case 'bottom-left':
            img.width -= deltaX;
            img.height = img.width / originalRatio;
            img.x += deltaX;
            break;
            
        case 'bottom-right':
            img.width += deltaX;
            img.height = img.width / originalRatio;
            break;
    }
    
    // Ensure minimum size
    if (img.width < 20) {
        img.width = 20;
        img.height = 20 / originalRatio;
    }
    
    redrawCanvas();
    updateResizeHandles();
}

// UI Functions
function updateResizeHandles() {
    // Remove existing handles
    document.querySelectorAll('.resize-handle').forEach(handle => handle.remove());
    
    // If no active image or in draw mode, don't show handles
    if (state.activeImageIndex === -1 || state.mode === 'draw') {
        return;
    }
    
    const img = state.images[state.activeImageIndex];
    const container = document.querySelector('.canvas-container');
    
    // Create new handles for each corner
    const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    positions.forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `resize-handle ${pos}`;
        container.appendChild(handle);
        
        // Position the handle
        if (pos === 'top-left') {
            handle.style.left = `${img.x}px`;
            handle.style.top = `${img.y}px`;
        } else if (pos === 'top-right') {
            handle.style.left = `${img.x + img.width}px`;
            handle.style.top = `${img.y}px`;
        } else if (pos === 'bottom-left') {
            handle.style.left = `${img.x}px`;
            handle.style.top = `${img.y + img.height}px`;
        } else if (pos === 'bottom-right') {
            handle.style.left = `${img.x + img.width}px`;
            handle.style.top = `${img.y + img.height}px`;
        }
    });
}

// Redraw the entire canvas
function redrawCanvas() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all images
    state.images.forEach((img, index) => {
        ctx.drawImage(img.img, img.x, img.y, img.width, img.height);
        
        // Highlight active image
        if (index === state.activeImageIndex && state.mode === 'move') {
            ctx.strokeStyle = '#0074cc';
            ctx.lineWidth = 2;
            ctx.strokeRect(img.x, img.y, img.width, img.height);
        }
    });
    
    // Draw all paths
    state.paths.forEach(path => {
        if (path.points.length < 2) return;
        
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);
        
        for (let i = 1; i < path.points.length; i++) {
            ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        
        ctx.lineWidth = path.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = path.color;
        ctx.stroke();
    });
}
