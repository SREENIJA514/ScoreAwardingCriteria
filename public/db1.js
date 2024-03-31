const express = require('express');
const multer = require('multer');
const mysql = require('mysql');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const dash = require('./dashboard.js')
const app = express();
const PORT = 4000;

app.use(cors());
//app.use('/favicon.ico', (req, res) => res.status(204));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

const db = mysql.createConnection({
  host: 'localhost',
    user: 'root',
    password: 'Rishi2912#mysql',
    database: 'web',
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
  } else {
    console.log('Connected to MySQL database');
  }
});

const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

app.use(express.json()); // Add this line to parse JSON in requests

app.get('/:page', (req, res) => {
  const page = req.params.page || 'index.html';
  res.sendFile(path.join(__dirname, `public/${page}`));
});

app.post('/updateTotalScore', express.json(), (req, res) => {
  console.log('Received updateTotalScore request:', req.body);
  const totalScore = req.body.totalScore;
  const columnName = req.body.columnName;
  const userId = req.query.userId;

  const updateQuery = `UPDATE criteria SET ${columnName} = ${columnName} + ? WHERE userId = ?`;

  db.query(updateQuery, [totalScore, userId], (err, result) => {
    if (err) {
      console.error('Error updating total score in the database:', err);
      if (err.code === 'UNKNOWN_CODE_PLEASE_REPORT' && err.sqlMessage.includes('chk_' + columnName + '_max')) {
        return res.status(400).json({ error: 'Max score exceeded' });
      }
      return res.status(500).json({ error: 'Internal Server Error', message: err.message });
    }

    if (result.affectedRows === 0) {
      res.status(404).send('User not present');
      return;
    }

    console.log('Total score updated successfully!');
    res.json({ success: true, message: 'Total score updated successfully!' });
  });
});

app.post('/updateDetails', express.json(), (req, res) => {
  console.log('Received updateDetails request:', req.body);
  const id = req.body.idCell;
  const name = req.body.nameCell;
  const designation = req.body.designationCell;
  const academicExp = req.body.academicCell;
  const industryExp = req.body.industryCell;
  const dept =  req.body.deptCell;
  const totalExp = req.body.totalCell;

  const updateQuery = `
    UPDATE profile 
    SET name = ?, designation = ?, academicExp = ?, industryExp = ?, totalExp = ?, dept = ? 
    WHERE id = ?;
  `;

  db.query(updateQuery, [name, designation, academicExp, industryExp, totalExp, dept, id], (err, result) => {
    if (err) {
        console.error('Error updating details in the database:', err);
        return res.status(500).json({ error: 'Internal Server Error', message: err.message });
      }

    console.log('Details updated successfully!');
    res.json({ success: true, message: 'Details updated successfully!' });
  });
});

app.post('/edit', upload.array('certificates'), (req, res) => {
  const userId = req.query.userId;
  const columnName = req.query.columnName;
  const oldFile = req.query.oldFile;
  const uploadedFiles = req.files;

  if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).send('No files were uploaded.');
  }

  const deleteQuery = 'DELETE FROM files WHERE filename = ? AND userId = ? AND columnName = ?';

  db.query(deleteQuery, [oldFile, userId, columnName], (err, result) => {
      if (err) {
          console.error('Error deleting file from database:', err);
          return res.sendStatus(500);
      }

      // Proceed to insert new files after deleting the old one
      const insertQuery = 'INSERT INTO files (filename, filepath, userId, columnName) VALUES (?, ?, ?, ?)';
     
      uploadedFiles.forEach(file => {
          const { originalname, path } = file;
          db.query(insertQuery, [originalname, path, userId, columnName], (err, result) => {
              if (err) {
                  console.error('Error inserting file into the database:', err);
                  return res.sendStatus(500);
              }
          });
      });

      res.send('Files edited successfully!');
  });
});

app.post('/uploadFiles', upload.array('certificates'), (req, res) => {
  const userId = req.query.userId;
  const columnName = req.query.columnName;
  const uploadedFiles = req.files;

  if (!uploadedFiles || uploadedFiles.length === 0) {
    return res.status(400).send('No files were uploaded.');
  }

  // Save file information to the database
  const insertQuery = 'INSERT INTO files (filename, filepath, userId, columnName) VALUES (?, ?, ?, ?)';
  
  uploadedFiles.forEach(file => {
    const { originalname, path } = file;
    db.query(insertQuery, [originalname, path, userId, columnName], (err, result) => {
      if (err) {
        console.error('Error inserting file into the database:', err);
        return res.sendStatus(500);
      }
    });
  });

  res.send('Files uploaded successfully!');
});

app.get('/download', (req, res) => {
  const fileId = req.query.fileId;
  if (!fileId) {
    return res.status(400).send('File ID is required.');
  }

  const selectQuery = 'SELECT * FROM files WHERE id = ?';
  
  db.query(selectQuery, [fileId], (err, result) => {
    if (err) {
      console.error('Error retrieving file from the database:', err);
      res.sendStatus(500);
    } else if (result.length === 0) {
      res.send('File not found.');
    } else {
      const { filename, filepath } = result[0];
      const fileStream = fs.createReadStream(filepath);

      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Content-Type', 'application/octet-stream');

      fileStream.pipe(res);
    }
  });
});

app.post('/targetValues', express.json(), (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'Bad Request', message: 'userId parameter is missing' });
  }

  const checkUserQuery = `SELECT * FROM target WHERE userId = ? LIMIT 1`;
  db.query(checkUserQuery, [userId], (checkUserErr, checkUserResult) => {
    if (checkUserErr) {
      console.error('Error checking user:', checkUserErr);
      return res.status(500).json({ error: 'Internal Server Error', message: checkUserErr.message });
    }

    if (checkUserResult.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    // Check if any column other than userId is not null
    const userRow = checkUserResult[0];
    const columnKeys = Object.keys(userRow).filter(key => key !== 'userId');
    const nonZeroColumns = columnKeys.filter(key => userRow[key] !== 0);

    if (nonZeroColumns.length > 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Target cannot be edited' });
    }

    // Proceed to update the score if all conditions are met

    const values = req.body.values; // Assuming the request body contains an array of values
    const total = req.body.total; // Assuming the request body contains the grand total

    // Construct the update query
    const updateQuery = `
      UPDATE target 
      SET 
          c11 = ?, c12 = ?, c13 = ?, c14 = ?, c15 = ?, c16 = ?,
          c21 = ?, c22 = ?, c23 = ?, c24 = ?, c25 = ?, c26 = ?,
          c31 = ?, c32 = ?, c33 = ?, c34 = ?, c35 = ?, c36 = ?, c37 = ?, c38 = ?,
          c41 = ?, c42 = ?, c43 = ?, c44 = ?, c45 = ?, c46 = ?,
          c51 = ?, c52 = ?, c53 = ?, c54 = ?, c55 = ?
      WHERE userId = ?;
    `;

    // Execute the update query
    db.query(updateQuery, [...values, userId], (updateErr, updateResult) => {
      if (updateErr) {
        console.error('Error updating target values:', updateErr);
        return res.status(500).json({ error: 'Internal Server Error', message: updateErr.message });
      }

      console.log('Values updated successfully in the target table!');
      res.json({ success: true, message: 'Values updated successfully in the target table!' });
    });
  });
});



app.listen(PORT, () => {
  console.log(`Server running at http://FACULTY-SCORE:${PORT}/`);
});