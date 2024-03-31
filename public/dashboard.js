const express = require('express');
const mysql = require('mysql');
const cors = require('cors'); // Add this line
const fs = require('fs');

const app = express();
const port = 5000;

// Enable CORS
app.use(cors()); 
// Create a MySQL connection
const db = mysql.createConnection({
host:'localhost',
user: 'root',
password: 'Rishi2912#mysql',
database: 'web',
});

// Connect to the database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
});

app.get('/getData', (req, res) => {
    const userId = req.query.userId;
    const criteriaLabelsParam = req.query.criteriaLabels;

    const criteriaLabels = criteriaLabelsParam ? criteriaLabelsParam.split(',') : ['c11', 'c12', 'c13', 'c14', 'c15', 'c16'];

    const criteriaQuery = 'SELECT * FROM criteria WHERE userId = ?'; 
    const targetQuery = 'SELECT * FROM target WHERE userId = ?'; 

    db.query(criteriaQuery, [userId],(err, criteriaResult) => {
        if (err) {
            console.error('Error executing the criteria query:', err);
            res.status(500).send('Internal Server Error');
            return;
        }

        db.query(targetQuery, [userId], (err, targetResult) => {
            if (err) {
                console.error('Error executing the target query:', err);
                res.status(500).send('Internal Server Error');
                return;
            }

            if (targetResult.length === 0) {
                res.status(404).send('User not present');
                return;
            }

            const yourScores = criteriaLabels.map((label) => criteriaResult[0][label]);
            const targetScores = criteriaLabels.map((label) => targetResult[0][label]);

            const responseData = {
                criteriaLabels: criteriaLabels,
                yourScores: yourScores,
                targetScores: targetScores,
            };
            console.log('Query result:', responseData);
            res.json(responseData);
        });
    });
});

app.get('/getDeptDetailsToP', (req, res) => {
    const dept = req.query.dept;
    console.log('Received request with dept:', dept);

        // Now fetch all users belonging to the same department
        const usersQuery = 'SELECT id, name FROM profile WHERE dept = ?';
        db.query(usersQuery, [dept], (err, usersResult) => {
            if (err) {
                console.error('Error fetching users from the same department:', err);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            // Extracting ids and names from the result
            const users = usersResult.map(user => ({ id: user.id, name: user.name }));

            // Send both department and users as response
            res.json({ users });
        });
});

app.get('/getDataHOD', (req, res) => {
    const id = req.query.id;
    console.log('Received request with id:', id);
  
    const query = 'SELECT * FROM profile WHERE id = ?';
    console.log('Executing query:', query);
  
    db.query(query, [id], (err, result) => {
      if (err) {
        console.error('Error executing the criteria query:', err);
        res.status(500).json({ error: 'Internal Server Error' });
        return;
      }
      console.log('Query result:', result);
      res.json(result);
    });
});

app.get('/getPercentage', (req, res) => {
    const userId = req.query.userId;
    const columnName = req.query.columnName;
    console.log('Received request with userId and columnName:', userId, columnName);

    let cm, tm;

    if (columnName) {
        cm = columnName;
        tm = columnName; 
    } else {
        cm = 'cTotal'; // Assuming 'cTotal' is the column name in your database
        tm = 'tTotal'; // Assuming 'tTotal' is the column name in your database
    }

    const cQuery = 'SELECT ?? FROM criteria WHERE userId = ?';
    const tQuery = 'SELECT ?? FROM target WHERE userId = ?';

    // Execute the queries
    db.query(cQuery, [cm, userId], (cErr, cResult) => {
        if (cErr) {
            console.error('Error fetching cTotal:', cErr);
            return res.status(500).json({ error: 'Internal Server Error', message: cErr.message });
        }

        db.query(tQuery, [tm, userId], (tErr, tResult) => {
            if (tErr) {
                console.error('Error fetching tTotal:', tErr);
                return res.status(500).json({ error: 'Internal Server Error', message: tErr.message });
            }

            const cTotal = cResult.length > 0 ? cResult[0][cm] : 0;
            const tTotal = tResult.length > 0 ? tResult[0][tm] : 0;
            console.log('criteria and target are ', cTotal, tTotal);
            let percentage = 100;
            if (tTotal !== 0) {
                percentage = (cTotal / tTotal) * 100;
            }

            res.json({ percentage: percentage });
        });
    });
});


app.get('/getProof', (req, res) => {
    const userId = req.query.userId;
    console.log('Received request with userId:', userId);

    if (!userId) {
        return res.status(400).json({ error: 'userId is a required parameter.' });
    }

    const selectQuery = 'SELECT filename, filepath, columnName FROM files WHERE userId = ?';

    db.query(selectQuery, [userId], (err, results) => {
        if (err) {
            console.error('Error retrieving file information from the database:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'No files found for the provided userId and columnName.' });
        }
        console.log('Query result:', results);
        res.json({ files: results });
    });
});

app.get('/download', (req, res) => {
    const userId = req.query.userId;
    const filename = req.query.filename;

    console.log('Received download request with userId:', userId, 'and filename:', filename);

    if (!userId || !filename) {
        return res.status(400).json({ error: 'Both userId and filename are required parameters.' });
    }

    const selectQuery = 'SELECT filepath FROM files WHERE userId = ? AND filename = ?';

    db.query(selectQuery, [userId, filename], (err, results) => {
        if (err) {
            console.error('Error retrieving file information from the database:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'File not found for the provided userId and filename.' });
        }

        const filepath = results[0].filepath;
        console.log('the file is at', filepath);
        const fileStream = fs.createReadStream(filepath);

        fileStream.on('error', (err) => {
            console.error('Error reading file:', err);
            return res.status(500).json({ error: 'Internal server error' });
        });

        res.setHeader('Content-disposition', 'attachment; filename=' + filename);
        res.setHeader('Content-type', 'application/octet-stream');

        fileStream.pipe(res);

    });
});

app.post('/delete', (req, res) => { 
    const userId = req.body.userId;
    const filename = req.body.filename;

    console.log('Received delete request with userId:', userId, 'and filename:', filename);

    if (!userId || !filename) {
        return res.status(400).json({ error: 'Both userId and filename are required parameters.' });
    }

    const deleteQuery = 'delete from files where userId = ? AND filename = ?';

    db.query(deleteQuery, [userId, filename], (err, results) => {
        if (err) {
            console.error('Error deleting file information from the database:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (results.affectedRows === 0) { // Check affectedRows
            return res.status(404).json({ error: 'File not found for the provided userId and filename.' });
        }
        
        console.log('File deleted successfully!');
        res.status(200).json({ message: 'File deleted successfully' }); 
    });
});

app.get('/userValidation', (req, res) => {
    const userId = req.query.userId;
    console.log('Received request with id:', userId);
  
    const query = 'SELECT password, hod FROM users WHERE userId = ?';
    console.log('Executing query:', query);
  
    db.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Error executing the criteria query:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        if (result.length === 0) {
            console.log('No user found with userId:', userId);
            return res.status(404).json({ error: 'INVALID USER' });
        }

        const { password, hod } = result[0];
        console.log('Query result:', { password, hod });
        res.json({ password, hod });
    });
});

app.get('/getName', (req, res) => {
    const id = req.query.userId;
    console.log('Received request with id:', userId);

    const query = 'SELECT name FROM profile WHERE id = ?';

    db.query(query, [id], (err, result) => {
        if (err) {
            console.error('Error executing the query:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        if (result.length === 0) {
            console.log('No user found with id:', id);
            return res.status(404).json({ error: 'User not found' });
        }

        const name = result[0].name;
        console.log('User name:', name);
        res.json({ name });
    });
});


app.post('/changePassword', (req, res) => {
    const userId = req.query.userId;
    const newPassword = req.query.newPassword;
    console.log('Received password change request with id:', userId);

    const query = 'UPDATE users SET password = ? WHERE userId = ?';

    db.query(query, [newPassword, userId], (err, result) => {
        if (err) {
            console.error('Error executing the change password query:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.status(200).json({ message: "Password changed successfully" });
            console.log('Password changed successfully');
        }
    });
});

app.get('/getDeptDetails', (req, res) => {
    const userId = req.query.userId;
    console.log('Received request with id:', userId);

    const query = 'SELECT dept FROM profile WHERE id = ?';
    db.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Error executing the department query:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        if (result.length === 0) {
            console.log('No user found with userId:', userId);
            res.json({ error: "INVALID USER" });
            return;
        }

        const department = result[0].dept;
        console.log('User belongs to department:', department);

        // Now fetch all users belonging to the same department
        const usersQuery = 'SELECT id, name FROM profile WHERE dept = ?';
        db.query(usersQuery, [department], (err, usersResult) => {
            if (err) {
                console.error('Error fetching users from the same department:', err);
                res.status(500).json({ error: 'Internal Server Error' });
                return;
            }

            // Extracting ids and names from the result
            const users = usersResult.map(user => ({ id: user.id, name: user.name }));

            // Send both department and users as response
            res.json({ department, users });
        });
    });
});


app.listen(port, () => {
    console.log(`Server is running on http://FACULTY-SCORE:${port}`);
});