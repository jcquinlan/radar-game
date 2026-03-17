import { describe, it, expect, beforeEach } from 'vitest';
import { BotSlotSystem, SlotState } from './BotSlotSystem';

describe('BotSlotSystem', () => {
  let system: BotSlotSystem;

  beforeEach(() => {
    system = new BotSlotSystem();
  });

  describe('initialization', () => {
    it('starts with 5 ready slots', () => {
      expect(system.getTotalSlots()).toBe(5);
      expect(system.getReadyCount()).toBe(5);
    });

    it('all slots start in ready state', () => {
      const slots = system.getSlots();
      for (let i = 0; i < slots.length; i++) {
        expect(slots[i].state).toBe(SlotState.Ready);
      }
    });
  });

  describe('acquireSlot', () => {
    it('returns index of first ready slot', () => {
      const index = system.acquireSlot();
      expect(index).toBe(0);
      expect(system.getReadyCount()).toBe(4);
    });

    it('marks acquired slot as active', () => {
      const index = system.acquireSlot();
      expect(system.getSlots()[index].state).toBe(SlotState.Active);
    });

    it('returns sequential indices for multiple acquisitions', () => {
      expect(system.acquireSlot()).toBe(0);
      expect(system.acquireSlot()).toBe(1);
      expect(system.acquireSlot()).toBe(2);
    });

    it('returns -1 when no slots are available', () => {
      for (let i = 0; i < 5; i++) {
        system.acquireSlot();
      }
      expect(system.acquireSlot()).toBe(-1);
    });

    it('can acquire a slot that was previously released and finished cooldown', () => {
      const index = system.acquireSlot();
      system.releaseSlot(index);

      // Tick through full cooldown
      system.update(10);

      const newIndex = system.acquireSlot();
      expect(newIndex).toBe(0);
      expect(system.getSlots()[newIndex].state).toBe(SlotState.Active);
    });
  });

  describe('releaseSlot', () => {
    it('starts cooldown on the released slot', () => {
      const index = system.acquireSlot();
      system.releaseSlot(index);

      expect(system.getSlots()[index].state).toBe(SlotState.Cooldown);
    });

    it('does not make the slot immediately ready', () => {
      const index = system.acquireSlot();
      system.releaseSlot(index);

      expect(system.getReadyCount()).toBe(4); // 5 total - 1 on cooldown
    });

    it('ignores release of invalid index', () => {
      system.releaseSlot(-1);
      system.releaseSlot(99);
      expect(system.getReadyCount()).toBe(5);
    });
  });

  describe('update (cooldown ticking)', () => {
    it('transitions slot from cooldown to ready after cooldown duration', () => {
      const index = system.acquireSlot();
      system.releaseSlot(index);
      expect(system.getSlots()[index].state).toBe(SlotState.Cooldown);

      // Default cooldown is 8s
      system.update(8);
      expect(system.getSlots()[index].state).toBe(SlotState.Ready);
    });

    it('does not transition before cooldown completes', () => {
      const index = system.acquireSlot();
      system.releaseSlot(index);

      system.update(4); // Half the cooldown
      expect(system.getSlots()[index].state).toBe(SlotState.Cooldown);
    });

    it('handles multiple slots on independent cooldowns', () => {
      const i0 = system.acquireSlot();
      const i1 = system.acquireSlot();

      system.releaseSlot(i0);
      system.update(4); // 4s into cooldown for slot 0

      system.releaseSlot(i1);
      system.update(4); // slot 0 at 8s (done), slot 1 at 4s

      expect(system.getSlots()[i0].state).toBe(SlotState.Ready);
      expect(system.getSlots()[i1].state).toBe(SlotState.Cooldown);

      system.update(4); // slot 1 at 8s (done)
      expect(system.getSlots()[i1].state).toBe(SlotState.Ready);
    });

    it('does not affect active or ready slots', () => {
      system.acquireSlot(); // slot 0 is active
      // slot 1-4 are ready

      system.update(100);

      expect(system.getSlots()[0].state).toBe(SlotState.Active);
      expect(system.getSlots()[1].state).toBe(SlotState.Ready);
    });
  });

  describe('setTotalSlots', () => {
    it('increases total slots', () => {
      system.setTotalSlots(7);
      expect(system.getTotalSlots()).toBe(7);
      expect(system.getReadyCount()).toBe(7);
    });

    it('new slots start as ready', () => {
      system.setTotalSlots(6);
      expect(system.getSlots()[5].state).toBe(SlotState.Ready);
    });

    it('does not reduce below current count (preserves existing slots)', () => {
      system.setTotalSlots(3);
      // Should have at least 3 slots, but existing active/cooldown slots preserved
      expect(system.getTotalSlots()).toBe(3);
    });
  });

  describe('setCooldownDuration', () => {
    it('changes cooldown duration for future releases', () => {
      system.setCooldownDuration(4);

      const index = system.acquireSlot();
      system.releaseSlot(index);
      system.update(4);

      expect(system.getSlots()[index].state).toBe(SlotState.Ready);
    });

    it('does not affect slots already in cooldown', () => {
      const index = system.acquireSlot();
      system.releaseSlot(index);

      // Change cooldown AFTER release
      system.setCooldownDuration(2);

      // Original 8s cooldown still applies to this slot
      system.update(2);
      expect(system.getSlots()[index].state).toBe(SlotState.Cooldown);
    });
  });

  describe('reset', () => {
    it('returns all slots to ready state', () => {
      system.acquireSlot();
      system.acquireSlot();
      const i2 = system.acquireSlot();
      system.releaseSlot(i2);

      system.reset();

      expect(system.getReadyCount()).toBe(5);
      for (const slot of system.getSlots()) {
        expect(slot.state).toBe(SlotState.Ready);
      }
    });
  });

  describe('getReadyCount', () => {
    it('returns count of ready slots', () => {
      expect(system.getReadyCount()).toBe(5);
      system.acquireSlot();
      expect(system.getReadyCount()).toBe(4);
      const i = system.acquireSlot();
      expect(system.getReadyCount()).toBe(3);
      system.releaseSlot(i);
      expect(system.getReadyCount()).toBe(3); // cooldown, not ready
      system.update(8);
      expect(system.getReadyCount()).toBe(4);
    });
  });
});
