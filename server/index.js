
/**
 * Backend Server untuk Nexus IPAM
 * Perlu install: npm install express oracledb cors body-parser
 * Jalankan dengan: node server/index.js
 */

const express = require('express');
const oracledb = require('oracledb');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Konfigurasi Koneksi Oracle
const dbConfig = {
  user: 'DATAMART',
  password: 'P4ssworddatamart',
  connectString: 'LAJKTDB05:6725/DWLA',
  // Opsi tambahan agar return object bukan array
  outFormat: oracledb.OUT_FORMAT_OBJECT 
};

// Inisialisasi Auto Commit
oracledb.autoCommit = true;

// --- API ROUTES ---

// 1. Get All Subnets & IPs
app.get('/api/subnets', async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    
    // Ambil Subnets
    const subnetsResult = await connection.execute(
      `SELECT * FROM SUBNETS`
    );
    
    // Ambil IP Records
    const ipsResult = await connection.execute(
      `SELECT * FROM IP_RECORDS`
    );

    // Format data agar sesuai struktur Frontend (Nested Records)
    const subnets = subnetsResult.rows.map(s => ({
      id: s.ID,
      name: s.NAME,
      cidr: s.CIDR,
      gateway: s.GATEWAY,
      vlan: s.VLAN,
      records: {} // Init container
    }));

    const ips = ipsResult.rows;
    
    // Gabungkan IP ke Subnet masing-masing
    ips.forEach(ip => {
      const parentSubnet = subnets.find(s => s.id === ip.SUBNET_ID);
      if (parentSubnet) {
        parentSubnet.records[ip.IP_ADDRESS] = {
          ip: ip.IP_ADDRESS,
          status: ip.STATUS,
          hostname: ip.HOSTNAME,
          owner: ip.OWNER,
          description: ip.DESCRIPTION,
          lastUpdated: ip.LAST_UPDATED
        };
      }
    });

    res.json(subnets);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error connecting to Oracle DB");
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
});

// 2. Create Subnet & Generate Initial IPs
app.post('/api/subnets', async (req, res) => {
  const { id, name, cidr, gateway, vlan, records } = req.body;
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    
    // Insert Subnet
    await connection.execute(
      `INSERT INTO SUBNETS (ID, NAME, CIDR, GATEWAY, VLAN) VALUES (:id, :name, :cidr, :gateway, :vlan)`,
      [id, name, cidr, gateway, vlan]
    );

    // Bulk Insert IPs (Batching for performance)
    const ipList = Object.values(records).map(r => ({
      ip: r.ip,
      subnet_id: id,
      status: r.status,
      hostname: r.hostname,
      last_updated: Date.now()
    }));

    if (ipList.length > 0) {
      const sql = `INSERT INTO IP_RECORDS (IP_ADDRESS, SUBNET_ID, STATUS, HOSTNAME, LAST_UPDATED) 
                   VALUES (:ip, :subnet_id, :status, :hostname, :last_updated)`;
      
      const options = {
        autoCommit: true,
        bindDefs: {
          ip: { type: oracledb.STRING, maxSize: 20 },
          subnet_id: { type: oracledb.STRING, maxSize: 50 },
          status: { type: oracledb.STRING, maxSize: 20 },
          hostname: { type: oracledb.STRING, maxSize: 100 },
          last_updated: { type: oracledb.NUMBER }
        }
      };

      await connection.executeMany(sql, ipList, options);
    }

    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// 3. Update IP Record
app.put('/api/ip', async (req, res) => {
  const { ip, subnetId, status, hostname, owner, description } = req.body;
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    
    await connection.execute(
      `UPDATE IP_RECORDS 
       SET STATUS = :status, 
           HOSTNAME = :hostname, 
           OWNER = :owner, 
           DESCRIPTION = :description,
           LAST_UPDATED = :updated
       WHERE IP_ADDRESS = :ip`,
       {
         status, hostname, owner, description, 
         updated: Date.now(),
         ip
       }
    );

    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// 4. Delete Subnet
app.delete('/api/subnets/:id', async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    // Karena CASCADE DELETE di setup di table, hapus subnet otomatis hapus IP
    await connection.execute(`DELETE FROM SUBNETS WHERE ID = :id`, [id]);
    res.json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Nexus IPAM Backend running on port ${PORT}`);
  console.log(`Connecting to Oracle: ${dbConfig.connectString}`);
});
