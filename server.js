const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Serve static files (the HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// In‑memory data store
let students = [];
let lessons = [];
let grades = [];
let nextId = { students: 1, lessons: 1, grades: 1 };

// Helper to generate simple IDs
function generateId(collection) {
    return String(nextId[collection]++);
}

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send current data to the new client
    socket.emit('initialData', { students, lessons, grades });

    // Student CRUD
    socket.on('addStudent', (data, callback) => {
        const newStudent = { id: generateId('students'), ...data };
        students.push(newStudent);
        io.emit('studentAdded', newStudent);
        if (callback) callback({ success: true, id: newStudent.id });
    });

    socket.on('updateStudent', (data) => {
        const index = students.findIndex(s => s.id === data.id);
        if (index !== -1) {
            students[index] = { ...students[index], ...data };
            io.emit('studentUpdated', students[index]);
        }
    });

    socket.on('deleteStudent', (id) => {
        students = students.filter(s => s.id !== id);
        io.emit('studentDeleted', id);
    });

    // Lesson CRUD
    socket.on('addLesson', (data, callback) => {
        const newLesson = { id: generateId('lessons'), ...data };
        lessons.push(newLesson);
        io.emit('lessonAdded', newLesson);
        if (callback) callback({ success: true, id: newLesson.id });
    });

    socket.on('updateLesson', (data) => {
        const index = lessons.findIndex(l => l.id === data.id);
        if (index !== -1) {
            lessons[index] = { ...lessons[index], ...data };
            io.emit('lessonUpdated', lessons[index]);
        }
    });

    socket.on('deleteLesson', (id) => {
        lessons = lessons.filter(l => l.id !== id);
        io.emit('lessonDeleted', id);
    });

    // Grade CRUD
    socket.on('addGrade', (data, callback) => {
        const newGrade = { id: generateId('grades'), ...data };
        grades.push(newGrade);
        io.emit('gradeAdded', newGrade);
        if (callback) callback({ success: true, id: newGrade.id });
    });

    socket.on('updateGrade', (data) => {
        const index = grades.findIndex(g => g.id === data.id);
        if (index !== -1) {
            grades[index] = { ...grades[index], ...data };
            io.emit('gradeUpdated', grades[index]);
        }
    });

    socket.on('deleteGrade', (id) => {
        grades = grades.filter(g => g.id !== id);
        io.emit('gradeDeleted', id);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Start server on port 3000 (or use environment variable)
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`On other devices, use http://<YOUR_SERVER_IP>:${PORT}`);
});
