import * as vscode from 'vscode';
import { phiColors } from 'phi-colors';

export module BackgroundPhiColors
{
    const applicationKey = "background-phi-colors";
    interface Property<valueT>
    {
        name: string;
        minValue?: valueT;
        maxValue?: valueT;
        defaultValue?: valueT;
        value: valueT;
    }
    const delay =
    {
        name: "delay",
        minValue: 50,
        maxValue: 1500,
        defaultValue: 250,
        value: 0,
    };
    let lastUpdateStamp = 0;
    const baseColor =
    {
        name: "baseColor",
        defaultValue: "#CC6666",
        value: "",
    };
    const indentAlpha =
    {
        name: "indentAlpha",
        defaultValue: 0x11,
        value: 0,
    };
    const indentActiveAlpha =
    {
        name: "indentActiveAlpha",
        defaultValue: 0x33,
        value: 0,
    };
    const symbolAlpha =
    {
        name: "symbolAlpha",
        defaultValue: 0x44,
        value: 0,
    };
    const tokenAlpha =
    {
        name: "tokenAlpha",
        defaultValue: 0x33,
        value: 0,
    };
    const tokenActiveAlpha =
    {
        name: "tokenActiveAlpha",
        defaultValue: 0x66,
        value: 0,
    };
    let baseColorHsla: phiColors.Hsla;
    let errorDecorationParam: { base: phiColors.Hsla, hue: number, alpha: number };
    let decorations: { [decorationParamJson: string]: { decorator: vscode.TextEditorDecorationType, rangesOrOptions: vscode.Range[] } } = { };

    export const getConfiguration = <type = vscode.WorkspaceConfiguration>(key?: string | Property<type>, section: string = applicationKey): type =>
    {
        if (!key || "string" === typeof key)
        {
            const rawKey = undefined === key ? undefined: key.split(".").reverse()[0];
            const rawSection = undefined === key || rawKey === key ? section: `${section}.${key.replace(/(.*)\.[^\.]+/, "$1")}`;
            const configuration = vscode.workspace.getConfiguration(rawSection);
            return rawKey ?
            configuration[rawKey]:
            configuration;
        }
        else
        {
            let result: type = getConfiguration<type>(key.name);
            if (undefined === result)
            {
                if (undefined !== key.defaultValue)
                {
                    result = key.defaultValue;
                }
            }
            else
            if (undefined !== key.minValue && result < key.minValue)
            {
                result = key.minValue;
            }
            else
            if (undefined !== key.maxValue && key.maxValue < result)
            {
                result = key.maxValue;
            }
            key.value = result;
            return result;
        }
    };

    export const getTicks = () => new Date().getTime();

    export const initialize = (context: vscode.ExtensionContext): void =>
    {
        context.subscriptions.push
        (
            //  コマンドの登録
            vscode.commands.registerCommand(`${applicationKey}.helloWorld`, async () => await vscode.window.showInformationMessage('Hello World!')),

            //  イベントリスナーの登録
            vscode.workspace.onDidChangeConfiguration(() => onDidChangeConfiguration()),
            vscode.window.onDidChangeActiveTextEditor(() => onDidChangeActiveTextEditor()),
            vscode.workspace.onDidChangeTextDocument(() => onDidChangeTextDocument()),
            vscode.window.onDidChangeTextEditorSelection(() => onDidChangeTextEditorSelection()),
        );

        onDidChangeConfiguration();
    };

    export const onDidChangeConfiguration = (): void =>
    {
        getConfiguration(delay);
        getConfiguration(baseColor);
        getConfiguration(indentAlpha);
        getConfiguration(indentActiveAlpha);
        getConfiguration(symbolAlpha);
        getConfiguration(tokenAlpha);
        getConfiguration(tokenActiveAlpha);
        baseColorHsla = phiColors.rgbaToHsla(phiColors.rgbaFromStyle(baseColor.value));
        Object.keys(decorations).forEach(i => decorations[i].decorator.dispose());
        decorations = { };
        errorDecorationParam = { base:baseColorHsla, hue: 0, alpha: 0 };

        vscode.window.visibleTextEditors.forEach(i => updateDecoration(i));
    };

    export const onDidChangeActiveTextEditor = (): void =>
    {
        const activeTextEditor = vscode.window.activeTextEditor;
        if (activeTextEditor)
        {
            updateDecoration(activeTextEditor);
        }
    };
    export const onDidChangeTextDocument = (): void =>
    {
        const activeTextEditor = vscode.window.activeTextEditor;
        if (activeTextEditor)
        {
            const updateStamp = getTicks();
            lastUpdateStamp = updateStamp;
            setTimeout
            (
                () =>
                {
                    if (lastUpdateStamp === updateStamp)
                    {
                        updateDecoration(activeTextEditor);
                    }
                },
                delay.value
            );
        }
    };
    export const onDidChangeTextEditorSelection = onDidChangeTextDocument;

    export const gcd = (a: number, b: number) : number => b ? gcd(b, a % b): a;

    export const getIndentSize = (text: string, tabSize: number): number =>
        text.replace(/\t/g, (s, offset) => s.repeat(tabSize -(offset %tabSize))).length;

    export const getIndentUnit =
    (
        indentSizeDistribution:{ [key: number]: number },
        tabSize: number,
        isDefaultIndentCharactorSpace: boolean
    ): string =>
    {
        if (isDefaultIndentCharactorSpace)
        {
            let indentUnitSize = tabSize;
            if (0 < Object.keys(indentSizeDistribution).length)
            {
                const sortedIndentSizeDistribution = Object.keys(indentSizeDistribution)
                    .map(key => parseInt(key))
                    .map(key => ({ indentSize: key, Count: indentSizeDistribution[key], }))
                    .sort((a, b) => b.Count -a.Count);
                if (1 < sortedIndentSizeDistribution.length)
                {
                    const failingLine = sortedIndentSizeDistribution[0].Count / 10;
                    const topIndentSizeDistribution = sortedIndentSizeDistribution.filter((i, index) => failingLine < i.Count && index < 10);
                    indentUnitSize = topIndentSizeDistribution.map(i => i.indentSize).reduce((a, b) => gcd(a, b));
                }
                else
                {
                    indentUnitSize = sortedIndentSizeDistribution[0].indentSize;
                }
            }
            return " ".repeat(indentUnitSize);
        }
        return "\t";
    };
    
    const makeRange = (textEditor: vscode.TextEditor, startPosition: number, length: number) => new vscode.Range
    (
        textEditor.document.positionAt(startPosition),
        textEditor.document.positionAt(startPosition +length)
    );

    const updateDecoration = (textEditor: vscode.TextEditor) =>
    {
        const text = textEditor.document.getText();
        const tabSize = undefined === textEditor.options.tabSize ?
            4:
            (
                "number" === typeof textEditor.options.tabSize ?
                    textEditor.options.tabSize:
                    parseInt(textEditor.options.tabSize)
            );

        //  clear
        Object.keys(decorations).forEach(i => decorations[i].rangesOrOptions = []);

        //  update
        updateIndentDecoration
        (
            text,
            textEditor,
            tabSize,
            getIndentSize
            (
                textEditor.document
                    .lineAt(textEditor.selection.active.line)
                    .text
                    .substr(0, textEditor.selection.active.character)
                    .replace(/[^ \t]+.*$/, ""
                ),
                tabSize
            )
        );
        updateSymbolsDecoration(text, textEditor, tabSize);
        updateTokesDecoration
        (
            text,
            textEditor,
            tabSize,
            regExpExecToArray
            (
                /\w+/gm,
                textEditor.document
                    .lineAt(textEditor.selection.active.line).text)
                    .map(i => i[0]
            )
        );
        updateBodySpacesDecoration(text, textEditor, tabSize);
        updateTrailSpacesDecoration(text, textEditor, tabSize);

        //  apply
        Object.keys(decorations).map(i => decorations[i]).forEach
        (
            i => textEditor.setDecorations(i.decorator, i.rangesOrOptions)
        );
    };
    export const makeHueDecoration = (hue: number, alpha: number) =>
    (
        {
            base: baseColorHsla,
            hue: hue +1,
            alpha: alpha
        }
    );
    export const addDecoration = (textEditor: vscode.TextEditor, startPosition: number, length: number, decorationParam: { base: phiColors.Hsla, hue: number, alpha: number }) =>
    {
        const key = JSON.stringify(decorationParam);
        if (!decorations[key])
        {
            decorations[key] =
            {
                decorator: createTextEditorDecorationType(decorationParam),
                rangesOrOptions: []
            };
        }
        decorations[key].rangesOrOptions.push
        (
            makeRange
            (
                textEditor,
                startPosition,
                length
            )
        );
    };
    export const updateIndentDecoration = (text: string, textEditor: vscode.TextEditor, tabSize: number, currentIndentSize: number) =>
    {
        const indents: { index: number, text: string, body: string }[] = [];
        let totalSpaces = 0;
        let totalTabs = 0;
        const indentSizeDistribution:{ [key: number]: number } = { };
        regExpExecToArray
        (
            /^([ \t]+)([^\r\n]*)$/gm,
            text
        )
        .forEach
        (
            match =>
            {
                indents.push
                (
                    {
                        index: match.index,
                        text: match[1],
                        body: match[2]
                    }
                );
                const length = match[1].length;
                const tabs = match[1].replace(/ /g, "").length;
                const spaces = length -tabs;
                totalSpaces += spaces;
                totalTabs += tabs;
                const indentSize = getIndentSize(match[1], tabSize);
                if (indentSizeDistribution[indentSize])
                {
                    ++indentSizeDistribution[indentSize];
                }
                else
                {
                    indentSizeDistribution[indentSize] = 1;
                }
            }
        );
        const isDefaultIndentCharactorSpace = totalTabs *tabSize <= totalSpaces;
        const indentUnit = getIndentUnit(indentSizeDistribution, tabSize, isDefaultIndentCharactorSpace);
        const indentUnitSize = getIndentSize(indentUnit, tabSize);
        const currentIndentIndex = Math.floor(currentIndentSize /indentUnitSize);
        //console.log(`indentSizeDistribution: ${JSON.stringify(indentSizeDistribution)}`);
        //console.log(`indentUnit: ${JSON.stringify(indentUnit)}`);

        indents.forEach
        (
            indent =>
            {
                let text = indent.text;
                let cursor = indent.index;
                let length = 0;
                for(let i = 0; 0 < text.length; ++i)
                {
                    cursor += length;
                    if (text.startsWith(indentUnit))
                    {
                        addDecoration
                        (
                            textEditor,
                            cursor,
                            length = indentUnit.length,
                            makeHueDecoration(i, ((currentIndentIndex === i) ? indentActiveAlpha: indentAlpha).value)
                        );
                        text = text.substr(indentUnit.length);
                    }
                    else
                    {
                        if (getIndentSize(text, tabSize) < indentUnitSize)
                        {
                            addDecoration
                            (
                                textEditor,
                                cursor,
                                length = text.length,
                                errorDecorationParam
                            );
                            text = "";
                        }
                        else
                        {
                            if (isDefaultIndentCharactorSpace)
                            {
                                const spaces = text.length -text.replace(/^ +/, "").length;
                                if (0 < spaces)
                                {
                                    addDecoration
                                    (
                                        textEditor,
                                        cursor,
                                        length = spaces,
                                        makeHueDecoration(i, ((currentIndentIndex === i) ? indentActiveAlpha: indentAlpha).value)
                                    );
                                    cursor += length;
                                }
                                addDecoration
                                (
                                    textEditor,
                                    cursor,
                                    length = 1,
                                    errorDecorationParam
                                );
                                const indentCount = Math.ceil(getIndentSize(text.substr(0, spaces +1), tabSize) /indentUnitSize) -1;
                                i += indentCount;
                                text = text.substr(spaces +1);
                            }
                            else
                            {
                                const spaces = text.length -text.replace(/$ +/, "").length;
                                addDecoration
                                (
                                    textEditor,
                                    cursor,
                                    length = spaces,
                                    errorDecorationParam
                                );
                                const indentCount = Math.ceil(spaces /indentUnitSize) -1;
                                i += indentCount;
                                text = text.substr(spaces);
                            }
                        }
                    }
                }
            }
        );
    };
    export const regExpExecToArray = (regexp: RegExp, text: string) =>
    {
        const result: RegExpExecArray[] = [];
        while(true)
        {
            const match = regexp.exec(text);
            if (null === match)
            {
                break;
            }
            result.push(match);
        }
        return result;
    };
    export const updateSymbolsDecoration = (text: string, textEditor: vscode.TextEditor, tabSize: number) => regExpExecToArray
    (
        /[\!\.\,\:\;\(\)\[\]\{\}\<\>\"\'\`\#\$\%\&\=\-\+\*\@\\\/\|\?\^\~"]/gm,
        text
    )
    .forEach
    (
        match => addDecoration
        (
            textEditor,
            match.index,
            match[0].length,
            makeHueDecoration
            (
                (
                    <{[key: string]: number}>
                    {
                        "!": 1,
                        ".": 2,
                        ",": 3,
                        ":": 4,
                        ";": 5,
                        "(": 6,
                        ")": 6,
                        "[": 7,
                        "]": 7,
                        "{": 8,
                        "}": 8,
                        "<": 9,
                        ">": 9,
                        "\"": 10,
                        "\'": 11,
                        "\`": 12,
                        "\#": 13,
                        "\$": 14,
                        "\%": 15,
                        "\&": 16,
                        "\=": 17,
                        "\-": 18,
                        "\+": 19,
                        "\*": 20,
                        "\@": 21,
                        "\\": 22,
                        "\/": 23,
                        "\|": 24,
                        "\?": 25,
                        "\^": 26,
                        "\~": 27,
                    }
                )[match[0]],
                symbolAlpha.value
            )
        )
    );
    export const hash = (source: string): number =>
        source.split("").map(i => i.codePointAt(0) || 0).reduce((a, b) => a *719 +b)
        %34; // ← 通常、こういうところの数字は素数にすることが望ましいがここについては https://wraith13.github.io/phi-ratio-coloring/phi-ratio-coloring.htm で類似色の出てくる周期をベース(8,13,21,...)に調整すること。
    export const updateTokesDecoration =
    (
        text: string,
        textEditor: vscode.TextEditor,
        tabSize: number,
        strongTokens: string[]
    ) => regExpExecToArray
    (
        /\w+/gm,
        text
    )
    .forEach
    (
        match => addDecoration
        (
            textEditor,
            match.index,
            match[0].length,
            makeHueDecoration
            (
                hash(match[0]),
                0 <= strongTokens.indexOf(match[0]) ?
                    tokenActiveAlpha.value:
                    tokenAlpha.value
            )
        )
    );
    export const updateBodySpacesDecoration = (text: string, textEditor: vscode.TextEditor, tabSize: number) => regExpExecToArray
    (
        /^([ \t]*)([^ \t\r\n]+)([^\r\n]+)([^ \t\r\n]+)([ \t]*)$/gm,
        text
    )
    .forEach
    (
        prematch => regExpExecToArray
        (
            / {2,}|\t+/gm,
            prematch[3]
        )
        .forEach
        (
            match => addDecoration
            (
                textEditor,
                prematch.index +prematch[1].length +prematch[2].length +match.index,
                match[0].length,
                makeHueDecoration
                (
                    match[0].startsWith("\t") ?
                        //  tabs
                        ((match[0].length *tabSize) -((prematch[1].length +prematch[2].length +match.index) %tabSize)) -1:
                        //  spaces
                        match[0].length -1,
                    indentAlpha.value
                )
            )
        )
    );
    export const updateTrailSpacesDecoration = (text: string, textEditor: vscode.TextEditor, tabSize: number) => regExpExecToArray
    (
        /^([^\r\n]*[^ \t\r\n]+)([ \t]+)$/gm,
        text
    )
    .forEach
    (
        match => addDecoration
        (
            textEditor,
            match.index +match[1].length,
            match[2].length,
            errorDecorationParam
        )
    );

    export const createTextEditorDecorationType = (decorationParam: { base: phiColors.Hsla, hue: number, alpha: number }): vscode.TextEditorDecorationType =>
        vscode.window.createTextEditorDecorationType
        (
            {
                backgroundColor: phiColors.rgbForStyle
                (
                        phiColors.hslaToRgba
                        (
                            phiColors.generate
                            (
                                decorationParam.base,
                                decorationParam.hue,
                                0,
                                0,
                                0
                            )
                        )
                )
                +((0x100 +decorationParam.alpha).toString(16)).substr(1)
            }
        );
}

export function activate(context: vscode.ExtensionContext): void
{
    BackgroundPhiColors.initialize(context);
}

export function deactivate(): void
{
}