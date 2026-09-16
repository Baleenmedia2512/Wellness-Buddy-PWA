import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nextOtpLastTried, shouldSubmitOtp } from './otpAutoVerify.js';

const ready = {
  isComplete: true,
  verified: false,
  loading: false,
  value: '1111',
  lastTried: '',
};

describe('shouldSubmitOtp', () => {
  it('submits once when the code first becomes complete', () => {
    assert.equal(shouldSubmitOtp(ready), true);
  });

  it('does not resubmit the same code after a failed verify (loading went false)', () => {
    assert.equal(shouldSubmitOtp({ ...ready, lastTried: '1111' }), false);
    assert.equal(shouldSubmitOtp({ ...ready, loading: true, lastTried: '1111' }), false);
  });

  it('does not submit while incomplete, verified, or loading', () => {
    assert.equal(shouldSubmitOtp({ ...ready, isComplete: false }), false);
    assert.equal(shouldSubmitOtp({ ...ready, verified: true }), false);
    assert.equal(shouldSubmitOtp({ ...ready, loading: true }), false);
    assert.equal(shouldSubmitOtp({ ...ready, value: '' }), false);
  });

  it('submits again after the user changes the code', () => {
    assert.equal(shouldSubmitOtp({ ...ready, value: '1112', lastTried: '1111' }), true);
  });

  it('submits the same digits again after the user clears a cell (lastTried reset)', () => {
    assert.equal(shouldSubmitOtp({ ...ready, lastTried: '' }), true);
  });
});

describe('nextOtpLastTried', () => {
  it('clears the attempt key when the code is incomplete', () => {
    assert.equal(nextOtpLastTried({
      isComplete: false, value: '111', lastTried: '1111', didSubmit: false,
    }), '');
  });

  it('records the submitted code', () => {
    assert.equal(nextOtpLastTried({
      isComplete: true, value: '1111', lastTried: '', didSubmit: true,
    }), '1111');
  });

  it('keeps lastTried when a complete failed code is not re-submitted', () => {
    assert.equal(nextOtpLastTried({
      isComplete: true, value: '1111', lastTried: '1111', didSubmit: false,
    }), '1111');
  });
});

describe('wrong-OTP retry loop (regression)', () => {
  it('only verifies once until the digits change', () => {
    let lastTried = '';
    const submit = (state) => {
      const didSubmit = shouldSubmitOtp({ ...state, lastTried });
      lastTried = nextOtpLastTried({ ...state, lastTried, didSubmit });
      return didSubmit;
    };

    assert.equal(submit({ isComplete: true, verified: false, loading: false, value: '0000' }), true);
    assert.equal(submit({ isComplete: true, verified: false, loading: true, value: '0000' }), false);
    assert.equal(submit({ isComplete: true, verified: false, loading: false, value: '0000' }), false);
    assert.equal(submit({ isComplete: true, verified: false, loading: false, value: '0000' }), false);

    assert.equal(submit({ isComplete: false, verified: false, loading: false, value: '000' }), false);
    assert.equal(submit({ isComplete: true, verified: false, loading: false, value: '0001' }), true);
  });
});
