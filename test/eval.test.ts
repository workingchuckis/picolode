import * as assert from 'assert';
import * as vscode from 'vscode';

describe('Evaluation command', () => {
	it('command is registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('picolode.evalSelection'));
	});
});
