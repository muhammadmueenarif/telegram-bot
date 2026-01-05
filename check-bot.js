#!/usr/bin/env node

/**
 * Helper script to check for and kill running bot instances
 * Usage: node check-bot.js [--kill]
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function checkRunningInstances() {
    try {
        // Find all node processes running index.js
        const { stdout } = await execAsync("ps aux | grep 'node.*index.js' | grep -v grep");
        
        if (!stdout.trim()) {
            console.log("✅ No running bot instances found");
            return [];
        }

        const lines = stdout.trim().split('\n');
        const processes = lines.map(line => {
            const parts = line.trim().split(/\s+/);
            return {
                pid: parts[1],
                user: parts[0],
                command: parts.slice(10).join(' ')
            };
        });

        console.log(`\n⚠️  Found ${processes.length} running bot instance(s):\n`);
        processes.forEach((proc, index) => {
            console.log(`  ${index + 1}. PID: ${proc.pid}`);
            console.log(`     User: ${proc.user}`);
            console.log(`     Command: ${proc.command}\n`);
        });

        return processes;
    } catch (error) {
        if (error.message.includes('Command failed') || error.stdout === '') {
            console.log("✅ No running bot instances found");
            return [];
        }
        throw error;
    }
}

async function killInstances(processes) {
    if (processes.length === 0) {
        console.log("No processes to kill");
        return;
    }

    console.log(`\n🛑 Killing ${processes.length} bot instance(s)...\n`);
    
    for (const proc of processes) {
        try {
            await execAsync(`kill ${proc.pid}`);
            console.log(`✅ Killed process ${proc.pid}`);
        } catch (error) {
            console.error(`❌ Failed to kill process ${proc.pid}: ${error.message}`);
        }
    }

    // Wait a moment and verify
    await new Promise(resolve => setTimeout(resolve, 1000));
    const remaining = await checkRunningInstances();
    
    if (remaining.length === 0) {
        console.log("\n✅ All bot instances have been stopped");
    } else {
        console.log(`\n⚠️  ${remaining.length} instance(s) still running. You may need to use 'kill -9'`);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const shouldKill = args.includes('--kill') || args.includes('-k');

    console.log("🔍 Checking for running bot instances...\n");
    
    const processes = await checkRunningInstances();

    if (processes.length > 0 && shouldKill) {
        await killInstances(processes);
    } else if (processes.length > 0) {
        console.log("\n💡 To kill these processes, run: node check-bot.js --kill");
        console.log("   Or manually: kill <PID>");
        process.exit(1);
    }
}

main().catch(error => {
    console.error("❌ Error:", error.message);
    process.exit(1);
});

