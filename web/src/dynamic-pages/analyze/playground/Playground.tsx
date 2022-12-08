import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'sql-formatter';
import { Button, Drawer, useEventCallback } from '@mui/material';
import { isNonemptyString, isNullish } from '@site/src/utils/value';
import LoadingButton from '@mui/lab/LoadingButton';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useAnalyzeContext } from '../charts/context';
import SQLEditor from './SQLEditor';
import { PredefinedQuestion } from './predefined';
import PredefinedGroups from './PredefinedGroups';
import { Gap, PlaygroundBody, PlaygroundButton, PlaygroundContainer, PlaygroundDescription, PlaygroundHeadline, PlaygroundMain, PlaygroundSide } from './styled';
import { Experimental } from '@site/src/components/Experimental';
import { aiQuestion } from '@site/src/api/core';
import ResultBlock from './ResultBlock';
import QuestionField from './QuestionField';
import { useAsyncOperation } from '@site/src/hooks/operation';
import { core } from '@site/src/api';
import { LoginRequired } from '@site/src/components/LoginRequired';

function Playground ({ open, onClose }: { open: boolean, onClose: () => void }) {
  const { repoName, repoId } = useAnalyzeContext();

  const [inputValue, setInputValue] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState<PredefinedQuestion>();
  const [customQuestion, setCustomQuestion] = useState('');

  const { data, loading, error, run } = useAsyncOperation({ sql: inputValue, type: 'repo', id: `${repoId ?? 'undefined'}` }, core.postPlaygroundSQL);
  const { data: questionSql, loading: questionLoading, error: questionError, run: runQuestion } = useAsyncOperation(customQuestion, useCallback(async (sql: string) => await aiQuestion(sql), []));

  const onChange = (newValue: string) => {
    setInputValue(newValue);
    setCurrentQuestion(undefined);
  };

  const handleFormatSQLClick = () => {
    const formattedSQL = format(inputValue, {
      language: 'mysql',
      uppercase: true,
      linesBetweenQueries: 2,
    });
    setInputValue(formattedSQL);
  };

  const handleSelectQuestion = useEventCallback((question: PredefinedQuestion) => {
    const trueSql = [
      { match: 'repoId', value: `${repoId ?? 'undefined'}` },
      { match: 'repoName', value: repoName ?? 'undefined' },
    ].reduce((sql, { match, value }) => sql.replaceAll(`{{${match}}}`, value), question.sql);
    setInputValue(trueSql);
    setCurrentQuestion(question);
  });

  useEffect(() => {
    if (isNonemptyString(questionSql)) {
      setInputValue(format(questionSql, {
        language: 'mysql',
        uppercase: true,
        linesBetweenQueries: 2,
      }));
    }
  }, [questionSql]);

  const defaultInput = useMemo(() => {
    return `
/* ⚠️ 
Playground uses LIMITED resource(cpu/mem), so SQL should add:

WHERE repo_id = ${repoId ?? 'undefined'}

to use index as much as possible, or it will be terminated.


Example:

SELECT
*
FROM
github_events
WHERE
repo_id = ${repoId ?? '{{repoId}}'}
LIMIT
1;
*/
`;
  }, [repoId]);

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      ModalProps={{
        keepMounted: true,
      }}
    >
      <PlaygroundContainer id="sql-playground-container">
        <PlaygroundBody>
          <PlaygroundSide>
            <PlaygroundHeadline>
              Playground: Customize your queries with SQL
              <Experimental feature="ai-playground">
                <> or AI<span className="opaque">🤖</span>️</>
              </Experimental>
              !
            </PlaygroundHeadline>
            <PlaygroundDescription>
              <li>Choose a question<Experimental feature="ai-playground"><> or create a new one</>
              </Experimental> below
              </li>
              <li>Check or edit the generated SQL（Optional）</li>
              <li>Run your SQL and enjoy your results</li>
            </PlaygroundDescription>
            <Experimental feature="ai-playground">
              <LoginRequired promote='Log in to write question' sx={{ mt: 1 }}>
                <QuestionField
                  loading={questionLoading}
                  error={questionError}
                  value={customQuestion}
                  onChange={setCustomQuestion}
                  onAction={runQuestion}
                />
              </LoginRequired>
            </Experimental>
            <PredefinedGroups onSelectQuestion={handleSelectQuestion} question={currentQuestion} />
          </PlaygroundSide>
          <PlaygroundMain>
            <SQLEditor
              loading={questionLoading || loading}
              mode="sql"
              theme="twilight"
              onChange={onChange}
              name="SQL_PLAYGROUND"
              showPrintMargin={false}
              value={inputValue || defaultInput}
              fontSize={16}
              setOptions={{
                enableLiveAutocompletion: true,
              }}
              extra={
                <>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={!inputValue || isNullish(repoId)}
                    onClick={handleFormatSQLClick}
                  >
                    Format
                  </Button>
                  <LoadingButton
                    variant="contained"
                    size="small"
                    disabled={!inputValue || isNullish(repoId)}
                    onClick={run}
                    endIcon={<PlayArrowIcon fontSize="inherit" />}
                    loading={loading}
                  >
                    Run
                  </LoadingButton>
                </>
              }
            />
            <Gap />
            <ResultBlock data={data} loading={loading} error={error} />
          </PlaygroundMain>
        </PlaygroundBody>
      </PlaygroundContainer>
    </Drawer>
  );
}

export function usePlayground () {
  const [open, setOpen] = useState(false);

  const handleClose = useEventCallback(() => {
    setOpen(false);
  });

  const handleClickTerminalBtn = useEventCallback((event: React.MouseEvent<HTMLElement>) => {
    setOpen(open => !open);
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toUpperCase() === 'K' && (event.ctrlKey || event.metaKey)) {
        // it was Ctrl + K (Cmd + K)
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const button = useMemo(() => {
    return (
      <PlaygroundButton
        className={open ? 'opened' : ''}
        aria-label="Open SQL Playground"
        onClick={handleClickTerminalBtn}
        disableRipple
        disableTouchRipple
        sx={{
          display: {
            xs: 'none',
            // Remove next line to show terminal button on desktop
            md: 'inline-flex',
          },
        }}
      >
        <img src={require('./icon.png').default} width="66" height="73" alt="Playground icon" />
      </PlaygroundButton>
    );
  }, [open]);

  const drawer = <Playground open={open} onClose={handleClose} />;

  return { button, drawer };
}