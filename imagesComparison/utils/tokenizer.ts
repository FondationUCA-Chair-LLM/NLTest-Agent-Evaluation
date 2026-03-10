import { Runnable } from "@langchain/core/runnables";
import { LLM } from "@langchain/core/language_models/llms";
import Asserter from "../models/Asserter.js";

class EndOfFactor extends Error {
    private index: number;
    private tree: Tree;

    public constructor(index: number, tree: Tree) {
        super();
        this.index = index;
        this.tree = tree;
    }


    public get Index(): number {
        return this.index
    }


    public get Tree(): Tree {
        return this.tree
    }

}

class Token {
    public type: "BOOL" | "AND" | "OR";
    private assertion?: string;
    private value?: boolean;

    public get Assertion(): string | undefined {
        return this.assertion;
    }


    public constructor(type: "BOOL" | "AND" | "OR", assertion?: string) {
        this.type = type
        this.assertion = assertion
    }

    public async evaluate(
        chunks: string[],
        llm: LLM,
        assert_all_chunks: (negative_assertion: boolean, chunks: string[], llm: LLM, assert_one_chunk: (chunk: string, chain: Runnable, inst?: string) => Promise<boolean>, inst?: string) => Promise<boolean>
    ): Promise<boolean> {
        console.log(` evaluate '${this.Assertion}'`)
        if (!this.value) this.value = await assert_all_chunks(Asserter.is_negative_assertion(this.Assertion), chunks, llm, Asserter.assert_chunk, this.assertion);
        return this.value;
    }

    // for debug
    public toString(nbSpaces: number): string {
        let arr: string[] = [];
        for (let index = 0; index < nbSpaces; index++) {
            arr.push("\t")
        }
        if (this.type != "BOOL") arr.push(`Token(${this.type})`);
        else arr.push(`Token(${this.assertion})`);
        return arr.join("");
    }
}

class Node {
    private token: Token;
    public min_height_left: number = -1;
    public min_height_right: number = -1;
    private left?: Node
    private right?: Node

    public constructor(type: "BOOL" | "AND" | "OR", assertion?: string) {
        this.token = new Token(type, assertion);
    }

    public get Left(): Node | undefined {
        return this.left;
    }

    public set Left(v: Node) {
        this.left = v;
        this.min_height_left = Math.min(v.min_height_left, v.min_height_right) + 1;
    }

    public get Right(): Node | undefined {
        return this.right;
    }

    public set Right(v: Node) {
        this.right = v;
        this.min_height_right = Math.min(v.min_height_left, v.min_height_right) + 1;
    }

    public async evaluate(
        chunks: string[],
        llm: LLM,
        assert_all_chunks: (negative_assertion: boolean, chunks: string[], llm: LLM, assert_one_chunk: (chunk: string, chain: Runnable, inst?: string) => Promise<boolean>, inst?: string) => Promise<boolean>
    ): Promise<boolean> {
        switch (this.token.type) {
            case "BOOL":
                // left and right must be undefined, this.assertion must not be undefined
                return await this.token.evaluate(chunks, llm, assert_all_chunks)
            case "AND":
                console.log(` evaluate 'AND'`)
                // left and right are not undefined or one is false, the other undefined
                if (this.min_height_left < this.min_height_right) {
                    if ((await this.Left?.evaluate(chunks, llm, assert_all_chunks)) == false)
                        return false;
                    else if ((await this.Right?.evaluate(chunks, llm, assert_all_chunks)) == false)
                        return false;
                    return true;
                }
                else {
                    if ((await this.Right?.evaluate(chunks, llm, assert_all_chunks)) == false)
                        return false;
                    else if ((await this.Left?.evaluate(chunks, llm, assert_all_chunks)) == false)
                        return false;
                    return true;
                }
            case "OR":
                console.log(` evaluate 'OR'`)
                // left and right are not undefined or one is false, the other undefined
                if (this.min_height_left < this.min_height_right) {
                    if ((await this.Left?.evaluate(chunks, llm, assert_all_chunks)) == true)
                        return true;
                    else if ((await this.Right?.evaluate(chunks, llm, assert_all_chunks)) == true)
                        return true;
                    return false;
                }
                else {
                    if ((await this.Right?.evaluate(chunks, llm, assert_all_chunks)) == true)
                        return true;
                    else if ((await this.Left?.evaluate(chunks, llm, assert_all_chunks)) == true)
                        return true;
                    return false;
                }
        }
    }

    // for debug
    public toString(nbSpaces: number = 0): string {
        let arr: string[] = [];
        if (this.Left) arr.push(`${this.Left.toString(nbSpaces + 1)}\n`);
        arr.push(`(left: ${this.min_height_left}, right: ${this.min_height_right}) ${this.token.toString(nbSpaces)}`);
        if (this.Right) arr.push(`\n${this.Right.toString(nbSpaces + 1)}`);
        return arr.join("");
    }
}

export type Tree = Node;

async function tokenize_word(
    words: string[],
    index: number,
    tree: Tree | undefined,
    isAssert: boolean,
    assertionArray: string[],
    input: string): Promise<{ isAssert: boolean, index: number, tree: Tree }> {
    // add a subtree to the tree
    // parameter : the subtree
    function addSubTree(subTree: Tree) {
        if (!tree) tree = subTree;
        else tree.Right = subTree;
    }
    // add an assertion to the tree
    // parameter : the assertion
    function addAssertion(value: string) {
        addSubTree(new Node("BOOL", value));
    }
    // add an assertion to the tree
    // parameter : Either an AND or an OR node
    function addNode(value: "AND" | "OR") {
        let node = new Node(value);
        if (tree) node.Left = tree;
        tree = node;
    }
    // flush the assertion array and add the assertion to the tree
    function flushAssertArray() {
        if (isAssert) {
            isAssert = false;
            const text = assertionArray.join(" ");
            assertionArray.splice(0, assertionArray.length);
            addAssertion(text)
        }
    }
    // assert case.
    // parameter : the assertion
    function assertCase(value: string) {
        assertionArray.push(value);
    }
    async function openBracketCase(index: number): Promise<{ isAssert: boolean, index: number, tree: Tree }> {
        if (isAssert) {
            const pos = input.indexOf(value, input.indexOf(assertionArray.join(" ")));
            throw new Error(`Unexpected token at position ${pos}\nassertion : '${input}'\npos : ${pos}, char : '${input[pos]}' (${input[pos].charCodeAt(0)})\nsubstring : ${input.substring(pos)}`);
        }
        try {
            await tokenize_factor(words, index, input)
            throw new Error("unclosed parenthese");
        }
        catch (e) {
            if (e instanceof EndOfFactor) {
                addSubTree(e.Tree)
                return { isAssert: false, index: e.Index, tree: tree! }
            }
            throw e
        }
    }
    function closeBracketCase(index: number) {
        flushAssertArray();
        throw new EndOfFactor(index, tree!);
    }
    function andCase() {
        flushAssertArray();
        addNode("AND")
    }
    function orCase() {
        flushAssertArray();
        addNode("OR")
    }
    let value = words[index]

    switch (value) {
        case "AND":
            andCase();
            break;
        case "OR":
            orCase();
            break;
        case "(":
            return await openBracketCase(index + 1)
        case ")":
            closeBracketCase(index + 1)
        default:
            if (isAssert) {
                assertCase(value);
            }
            else if (value == "Assert") {
                assertCase(value);
                isAssert = true;
            }
            else {
                const pos = input.indexOf(value);
                throw new Error(`Unexpected token at position ${pos}\nassertion : '${input}'\npos : ${pos}, char : '${input[pos]}' (${input[pos].charCodeAt(0)})\nsubstring : ${input.substring(pos)}`);
            }
    }
    return { isAssert: isAssert, index: index + 1, tree: tree! };
}

async function tokenize_factor(
    words: string[],
    index: number,
    input: string
): Promise<{ tree: Tree, index: number }> {
    let isAssert: boolean = false;
    let assertionArray: string[] = [];
    let tree: Tree | undefined = undefined;
    let i = index;
    while (i < words.length) {
        let result = await tokenize_word(words, i, tree, isAssert, assertionArray, input)
        isAssert = result.isAssert;
        tree = result.tree;
        i = result.index;
    }
    if (assertionArray.length != 0) {
        const text = assertionArray.join(" ");

        if (!tree) tree = new Node("BOOL", text);
        else tree.Right = new Node("BOOL", text);
    }

    console.log(`${tree}`)

    return { tree: tree!, index: i }
}

export async function tokenize(
    input: string,
): Promise<Tree> {
    if (!input.match(/^[\(\s]*Assert/)) throw new Error("Expression is not an assertion");
    let tree: Node | undefined;
    const words = input.replace(/([\(\)])/g, " $1 ")
        .trim()
        .split(/\s+/);
    console.log(`words : ${words}`)
    try {
        const result = await tokenize_factor(words, 0, input);
        if (result.index != words.length) {
            throw new Error(`cannot read all assertions. Stopped at word ${result.index} of ${words.length}`)
        }
        return result.tree;
    }
    catch (e) {
        if (e instanceof EndOfFactor) {
            throw Error("bad parenthes arrangement")
        }
        throw e;
    }
}